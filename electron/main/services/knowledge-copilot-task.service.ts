import { z } from 'zod';
import { createAgent, humanInTheLoopMiddleware, tool, type HITLRequest, type HITLResponse } from 'langchain';
import { Command, MemorySaver, type Interrupt } from '@langchain/langgraph';
import { createProviderChatModel } from './ai-provider.service.js';
import { getErrorMessage } from './error.service.js';
import { knowledgeCopilotIndexService } from './knowledge-copilot-index.service.js';
import { assessKnowledgeEvidence } from './knowledge-evidence-assessment.service.js';
import { ensureKnowledgeCopilotReady } from './knowledge-copilot-qa.service.js';
import { vfsService } from './vfs.service.js';
import { VFS_CONSTANTS } from '../constants/vfs.constants.js';
import { buildAgentSystemPrompt } from '../prompts/index.js';
import { $t } from '../utils/i18n.js';

const AGENT_TOOL_CONTENT_LIMIT = 1800;
const AGENT_NOTE_CONTENT_LIMIT = 6000;
const AGENT_MAX_TOOL_CALLS = 8;

const SearchKnowledgeBaseToolArgsSchema = z.object({
  query: z.string().min(1),
});

const ListRecentNotesToolArgsSchema = z.object({
  limit: z.number().int().positive().max(20).optional().default(8),
});

const ReadNoteToolArgsSchema = z.object({
  noteId: z.string().min(1),
});

const ProposeCreateNoteToolArgsSchema = z.object({
  title: z.string().min(1).max(120),
  content: z.string().min(1).max(12000),
  reason: z.string().min(1).max(500),
});

const ProposeUpdateNoteToolArgsSchema = z.object({
  noteId: z.string().min(1),
  content: z.string().min(1).max(16000),
  reason: z.string().min(1).max(500),
});

const RenameNoteToolArgsSchema = z.object({
  noteId: z.string().min(1),
  name: z.string().min(1).max(120),
});

const MoveNoteToolArgsSchema = z.object({
  noteId: z.string().min(1),
  parentId: z.string().min(1).nullable(),
  index: z.number().int().nonnegative().default(0),
});

const NoteIdToolArgsSchema = z.object({ noteId: z.string().min(1) });

type KnowledgeSearchResults = Awaited<ReturnType<typeof knowledgeCopilotIndexService.searchByVector>>;
type KnowledgeCopilotConfig = Awaited<ReturnType<typeof ensureKnowledgeCopilotReady>>;

export interface KnowledgeCopilotStep {
  title: string;
  detail: string;
  status: 'completed' | 'failed';
}

export interface KnowledgeCopilotTraceEvent {
  id: string;
  type: 'model-response' | 'tool-call' | 'tool-result' | 'tool-error';
  title: string;
  detail: string;
  status: 'completed' | 'failed';
  at: number;
  durationMs?: number;
  toolName?: string;
}

export interface KnowledgeCopilotCreateNoteProposal {
  id: string;
  type: 'create-note';
  title: string;
  content: string;
  reason: string;
}

export interface KnowledgeCopilotUpdateNoteProposal {
  id: string;
  type: 'update-note';
  noteId: string;
  noteTitle: string;
  content: string;
  reason: string;
}

export type KnowledgeCopilotWriteProposal =
  | KnowledgeCopilotCreateNoteProposal
  | KnowledgeCopilotUpdateNoteProposal;

export type KnowledgeCopilotWriteMode = 'confirm' | 'auto';

export interface KnowledgeCopilotExecutedCreateNote {
  id: string;
  type: 'create-note';
  noteId: string;
  noteTitle: string;
  content: string;
  reason: string;
}

export interface KnowledgeCopilotExecutedUpdateNote {
  id: string;
  type: 'update-note';
  noteId: string;
  noteTitle: string;
  content: string;
  reason: string;
}

export type KnowledgeCopilotExecutedWrite =
  | KnowledgeCopilotExecutedCreateNote
  | KnowledgeCopilotExecutedUpdateNote;

export type KnowledgeCopilotStopReason =
  | 'completed'
  | 'interrupted'
  | 'insufficient-evidence'
  | 'tool-call-limit'
  | 'tool-failure-limit';

export interface KnowledgeCopilotTaskResult {
  success: boolean;
  finalAnswer?: string;
  steps: KnowledgeCopilotStep[];
  traceEvents: KnowledgeCopilotTraceEvent[];
  sources: KnowledgeSearchResults;
  writeMode: KnowledgeCopilotWriteMode;
  pendingWrites: KnowledgeCopilotWriteProposal[];
  executedWrites: KnowledgeCopilotExecutedWrite[];
  stopReason?: KnowledgeCopilotStopReason;
  error?: string;
  conversationId: string;
  pendingActions: KnowledgeCopilotPendingAction[];
}

export interface KnowledgeCopilotPendingAction {
  name: string;
  args: Record<string, unknown>;
  description?: string;
  allowedDecisions: Array<'approve' | 'edit' | 'reject'>;
}

interface AgentExecutionState {
  sources: KnowledgeSearchResults;
  pendingWrites: KnowledgeCopilotWriteProposal[];
  executedWrites: KnowledgeCopilotExecutedWrite[];
  steps: KnowledgeCopilotStep[];
  traceEvents: KnowledgeCopilotTraceEvent[];
  toolCallCount: number;
  lastSearchHadSufficientEvidence: boolean | null;
  hadSufficientEvidence: boolean;
}

interface RunKnowledgeCopilotTaskOptions {
  writeMode?: KnowledgeCopilotWriteMode;
  conversationId?: string;
  decisions?: HITLResponse['decisions'];
}

const checkpointer = new MemorySaver();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function limitText(text: string, maxLength: number): string {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength)}...`;
}

function createToolResponse(payload: Record<string, unknown>): string {
  return JSON.stringify(payload);
}

function createInsufficientEvidenceMessage(): string {
  return $t(
    'search.knowledgeCopilotInsufficientEvidence',
    'The current knowledge base does not contain enough evidence to answer this question.',
  );
}

function createWriteBlockedMessage(): string {
  return $t(
    'search.agentWriteBlockedInsufficientEvidence',
    'Current evidence is insufficient to perform a write action.',
  );
}

function createTraceEvent(
  state: AgentExecutionState,
  event: Omit<KnowledgeCopilotTraceEvent, 'id' | 'at'> & { at?: number },
): void {
  state.traceEvents.push({
    id: `knowledge-copilot-trace-${Date.now()}-${state.traceEvents.length}`,
    at: event.at ?? Date.now(),
    ...event,
  });
}

function addUniqueSources(target: KnowledgeSearchResults, nextSources: KnowledgeSearchResults): void {
  const existingIds = new Set(target.map((source) => source.chunk.id));
  for (const source of nextSources) {
    if (!existingIds.has(source.chunk.id)) {
      target.push(source);
      existingIds.add(source.chunk.id);
    }
  }
}

function getActiveNoteNode(noteId: string) {
  return vfsService.getAllNodes().find((node) => (
    node.id === noteId
    && node.type === VFS_CONSTANTS.NODE_TYPE_FILE
    && !node.trashed
    && typeof node.contentId === 'string'
  ));
}

function ensureWriteEvidenceAllowed(state: AgentExecutionState): void {
  if (state.lastSearchHadSufficientEvidence === false) {
    throw new Error(createWriteBlockedMessage());
  }
}

function extractFinalAnswer(result: unknown): string {
  if (!isRecord(result) || !Array.isArray(result.messages)) {
    return '';
  }

  const lastMessage = [...result.messages].reverse().find(isRecord);
  const content = lastMessage?.content;
  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') return item;
        if (isRecord(item) && typeof item.text === 'string') return item.text;
        return '';
      })
      .join('')
      .trim();
  }

  return '';
}

async function executeToolWithTrace<TArgs>(
  state: AgentExecutionState,
  toolName: string,
  args: TArgs,
  execute: () => Promise<string>,
): Promise<string> {
  const startedAt = Date.now();
  state.toolCallCount += 1;
  createTraceEvent(state, {
    type: 'tool-call',
    title: toolName,
    detail: limitText(JSON.stringify(args), 500),
    status: 'completed',
    toolName,
    at: startedAt,
  });

  if (state.toolCallCount > AGENT_MAX_TOOL_CALLS) {
    const error = createToolResponse({ success: false, error: 'tool-call-limit' });
    createTraceEvent(state, {
      type: 'tool-error',
      title: toolName,
      detail: 'tool-call-limit',
      status: 'failed',
      toolName,
      at: startedAt,
      durationMs: Date.now() - startedAt,
    });
    return error;
  }

  try {
    const result = await execute();
    createTraceEvent(state, {
      type: 'tool-result',
      title: toolName,
      detail: limitText(result, 800),
      status: 'completed',
      toolName,
      at: startedAt,
      durationMs: Date.now() - startedAt,
    });
    return result;
  } catch (error) {
    const message = getErrorMessage(error);
    state.steps.push({
      title: toolName,
      detail: message,
      status: 'failed',
    });
    createTraceEvent(state, {
      type: 'tool-error',
      title: toolName,
      detail: message,
      status: 'failed',
      toolName,
      at: startedAt,
      durationMs: Date.now() - startedAt,
    });
    return createToolResponse({ success: false, error: message });
  }
}

function buildLangChainTools(config: KnowledgeCopilotConfig, state: AgentExecutionState) {
  const refreshNoteIndex = async (noteId: string): Promise<void> => {
    const node = getActiveNoteNode(noteId);
    if (!node?.contentId) return;
    await knowledgeCopilotIndexService.indexNote({
      noteId: node.id,
      noteTitle: node.name,
      content: await vfsService.readContent(node.contentId),
      chunkSize: 500,
      chunkOverlap: 50,
    });
  };
  const searchKnowledgeBase = tool(
    async (args) => executeToolWithTrace(state, 'searchKnowledgeBase', args, async () => {
      const validated = SearchKnowledgeBaseToolArgsSchema.parse(args);
      const results = await knowledgeCopilotIndexService.searchKnowledgeBase({
        query: validated.query,
        topK: Number(config.knowledgeCopilot.topK),
        similarityThreshold: Number(config.knowledgeCopilot.similarityThreshold),
        rerankerConfig: config.rerankerConfig,
      });
      const evidence = assessKnowledgeEvidence(results);

      addUniqueSources(state.sources, results);
      state.lastSearchHadSufficientEvidence = evidence.sufficient;
      if (evidence.sufficient) {
        state.hadSufficientEvidence = true;
      }
      state.steps.push({
        title: 'searchKnowledgeBase',
        detail: evidence.sufficient ? `${results.length}` : createInsufficientEvidenceMessage(),
        status: evidence.sufficient ? 'completed' : 'failed',
      });

      return createToolResponse({
        success: evidence.sufficient,
        insufficientEvidence: !evidence.sufficient,
        error: evidence.sufficient ? undefined : createInsufficientEvidenceMessage(),
        results: results.map((result) => ({
          noteId: result.chunk.noteId,
          noteTitle: result.noteTitle ?? '',
          score: result.score,
          content: limitText(result.chunk.content, AGENT_TOOL_CONTENT_LIMIT),
        })),
      });
    }),
    {
      name: 'searchKnowledgeBase',
      description: 'Search the user knowledge base for note chunks relevant to the current task.',
      schema: SearchKnowledgeBaseToolArgsSchema,
    },
  );

  const listRecentNotes = tool(
    async (args) => executeToolWithTrace(state, 'listRecentNotes', args, async () => {
      const validated = ListRecentNotesToolArgsSchema.parse(args);
      const notes = vfsService.getAllNodes()
        .filter((node) => (
          node.type === VFS_CONSTANTS.NODE_TYPE_FILE
          && !node.trashed
          && typeof node.contentId === 'string'
        ))
        .sort((left, right) => Number(right.updatedAt ?? 0) - Number(left.updatedAt ?? 0))
        .slice(0, validated.limit)
        .map((node) => ({
          noteId: node.id,
          noteTitle: node.name,
          updatedAt: node.updatedAt,
        }));
      return createToolResponse({ success: true, notes });
    }),
    {
      name: 'listRecentNotes',
      description: 'List recent active notes by update time without reading full note content.',
      schema: ListRecentNotesToolArgsSchema,
    },
  );

  const readNote = tool(
    async (args) => executeToolWithTrace(state, 'readNote', args, async () => {
      const validated = ReadNoteToolArgsSchema.parse(args);
      const node = getActiveNoteNode(validated.noteId);
      if (!node?.contentId) {
        throw new Error(`Note not found: ${validated.noteId}`);
      }

      const content = await vfsService.readContent(node.contentId);
      state.steps.push({
        title: 'readNote',
        detail: node.name,
        status: 'completed',
      });
      return createToolResponse({
        success: true,
        note: {
          noteId: node.id,
          noteTitle: node.name,
          content: limitText(content, AGENT_NOTE_CONTENT_LIMIT),
        },
      });
    }),
    {
      name: 'readNote',
      description: 'Read the full content of a note by noteId.',
      schema: ReadNoteToolArgsSchema,
    },
  );

  const createNote = tool(
    async (args) => executeToolWithTrace(state, 'createNote', args, async () => {
      ensureWriteEvidenceAllowed(state);
      const validated = ProposeCreateNoteToolArgsSchema.parse(args);
      const node = await vfsService.createFile(null, validated.title.trim(), validated.content.trim());
      await refreshNoteIndex(node.id);
      const executedWrite: KnowledgeCopilotExecutedCreateNote = {
        id: `knowledge-copilot-write-${Date.now()}-${state.executedWrites.length}`,
        type: 'create-note',
        noteId: node.id,
        noteTitle: node.name,
        content: validated.content.trim(),
        reason: validated.reason.trim(),
      };
      state.executedWrites.push(executedWrite);
      state.steps.push({ title: 'createNote', detail: executedWrite.noteTitle, status: 'completed' });
      return createToolResponse({ success: true, note: { noteId: node.id, noteTitle: node.name } });
    }),
    {
      name: 'createNote',
      description: 'Create a new note immediately in the workspace root.',
      schema: ProposeCreateNoteToolArgsSchema,
    },
  );

  const updateNote = tool(
    async (args) => executeToolWithTrace(state, 'updateNote', args, async () => {
      ensureWriteEvidenceAllowed(state);
      const validated = ProposeUpdateNoteToolArgsSchema.parse(args);
      const node = getActiveNoteNode(validated.noteId);
      if (!node?.contentId) {
        throw new Error(`Note not found: ${validated.noteId}`);
      }

      await vfsService.writeContent(node.contentId, validated.content.trim());
      await refreshNoteIndex(node.id);
      const executedWrite: KnowledgeCopilotExecutedUpdateNote = {
        id: `knowledge-copilot-write-${Date.now()}-${state.executedWrites.length}`,
        type: 'update-note',
        noteId: node.id,
        noteTitle: node.name,
        content: validated.content.trim(),
        reason: validated.reason.trim(),
      };
      state.executedWrites.push(executedWrite);
      state.steps.push({ title: 'updateNote', detail: executedWrite.noteTitle, status: 'completed' });
      return createToolResponse({ success: true, note: { noteId: node.id, noteTitle: node.name } });
    }),
    {
      name: 'updateNote',
      description: 'Replace the full content of an existing note immediately.',
      schema: ProposeUpdateNoteToolArgsSchema,
    },
  );

  const renameNote = tool(
    async (args) => executeToolWithTrace(state, 'renameNote', args, async () => {
      const validated = RenameNoteToolArgsSchema.parse(args);
      const node = await vfsService.renameNode(validated.noteId, validated.name.trim());
      await refreshNoteIndex(node.id);
      state.steps.push({ title: 'renameNote', detail: node.name, status: 'completed' });
      return createToolResponse({ success: true, note: { noteId: node.id, noteTitle: node.name } });
    }),
    { name: 'renameNote', description: 'Rename an active note.', schema: RenameNoteToolArgsSchema },
  );

  const moveNote = tool(
    async (args) => executeToolWithTrace(state, 'moveNote', args, async () => {
      const validated = MoveNoteToolArgsSchema.parse(args);
      const node = await vfsService.moveNode(validated.noteId, validated.parentId, validated.index);
      await refreshNoteIndex(node.id);
      state.steps.push({ title: 'moveNote', detail: node.name, status: 'completed' });
      return createToolResponse({ success: true, note: { noteId: node.id, parentId: node.parentId } });
    }),
    { name: 'moveNote', description: 'Move an active note to a notebook or workspace root.', schema: MoveNoteToolArgsSchema },
  );

  const trashNote = tool(
    async (args) => executeToolWithTrace(state, 'trashNote', args, async () => {
      const validated = NoteIdToolArgsSchema.parse(args);
      const [node] = await vfsService.deleteNodes([validated.noteId]);
      await knowledgeCopilotIndexService.deleteNoteIndex(node.id);
      state.steps.push({ title: 'trashNote', detail: node.name, status: 'completed' });
      return createToolResponse({ success: true, note: { noteId: node.id, noteTitle: node.name } });
    }),
    { name: 'trashNote', description: 'Move an active note to trash. This is reversible.', schema: NoteIdToolArgsSchema },
  );

  const restoreNote = tool(
    async (args) => executeToolWithTrace(state, 'restoreNote', args, async () => {
      const validated = NoteIdToolArgsSchema.parse(args);
      const node = await vfsService.restoreNode(validated.noteId);
      await refreshNoteIndex(node.id);
      state.steps.push({ title: 'restoreNote', detail: node.name, status: 'completed' });
      return createToolResponse({ success: true, note: { noteId: node.id, noteTitle: node.name } });
    }),
    { name: 'restoreNote', description: 'Restore a note from trash.', schema: NoteIdToolArgsSchema },
  );

  return [searchKnowledgeBase, listRecentNotes, readNote, createNote, updateNote, renameNote, moveNote, trashNote, restoreNote];
}

function extractPendingActions(result: unknown): KnowledgeCopilotPendingAction[] {
  if (!isRecord(result) || !Array.isArray(result.__interrupt__)) return [];
  const interrupt = result.__interrupt__[0] as Interrupt<HITLRequest> | undefined;
  const request = interrupt?.value;
  if (!request) return [];
  return request.actionRequests.map((action, index) => ({
    name: action.name,
    args: action.args,
    description: action.description,
    allowedDecisions: request.reviewConfigs[index]?.allowedDecisions ?? ['approve', 'reject'],
  }));
}

export async function runKnowledgeCopilotTask(
  task: string,
  options: RunKnowledgeCopilotTaskOptions = {},
): Promise<KnowledgeCopilotTaskResult> {
  const writeMode = options.writeMode === 'auto' ? 'auto' : 'confirm';
  const conversationId = options.conversationId?.trim() || crypto.randomUUID();
  const config = await ensureKnowledgeCopilotReady();
  const state: AgentExecutionState = {
    sources: [],
    pendingWrites: [],
    executedWrites: [],
    steps: [],
    traceEvents: [],
    toolCallCount: 0,
    lastSearchHadSufficientEvidence: null,
    hadSufficientEvidence: false,
  };

  if (!config.agentChatConfig) {
    return {
      success: false,
      error: 'Chat model is not configured for agent tasks.',
      finalAnswer: undefined,
      steps: [{ title: 'configureChatModel', detail: 'missing', status: 'failed' }],
      traceEvents: [],
      sources: [],
      writeMode,
      pendingWrites: [],
      executedWrites: [],
      stopReason: undefined,
      conversationId,
      pendingActions: [],
    };
  }

  const llm = createProviderChatModel({
    provider: config.agentChatConfig.provider,
    baseUrl: config.agentChatConfig.baseUrl,
    apiKey: config.agentChatConfig.apiKey,
    model: config.agentChatConfig.model,
  });
  const agent = createAgent({
    model: llm,
    tools: buildLangChainTools(config, state),
    systemPrompt: buildAgentSystemPrompt(writeMode, config.uiLanguage, task),
    checkpointer,
    middleware: [humanInTheLoopMiddleware({
      interruptOn: {
        createNote: writeMode === 'confirm',
        updateNote: writeMode === 'confirm',
        renameNote: true,
        moveNote: true,
        trashNote: true,
        restoreNote: true,
      },
      descriptionPrefix: 'Knowledge Copilot action requires approval',
    })],
  });

  const startedAt = Date.now();
  const result = await agent.invoke(
    options.decisions
      ? new Command({ resume: { decisions: options.decisions } })
      : { messages: [{ role: 'user', content: task }] },
    { configurable: { thread_id: conversationId } },
  );
  const pendingActions = extractPendingActions(result);
  createTraceEvent(state, {
    type: 'model-response',
    title: 'modelResponse',
    detail: 'completed',
    status: 'completed',
    at: startedAt,
    durationMs: Date.now() - startedAt,
  });

  const stopReason: KnowledgeCopilotStopReason = pendingActions.length > 0
    ? 'interrupted'
    : state.toolCallCount > AGENT_MAX_TOOL_CALLS
    ? 'tool-call-limit'
    : state.lastSearchHadSufficientEvidence === false && !state.hadSufficientEvidence
      ? 'insufficient-evidence'
      : 'completed';

  return {
    success: true,
    finalAnswer: stopReason === 'interrupted'
      ? undefined
      : stopReason === 'insufficient-evidence'
      ? createInsufficientEvidenceMessage()
      : extractFinalAnswer(result) || 'Agent task completed.',
    steps: state.steps,
    traceEvents: state.traceEvents,
    sources: state.sources,
    writeMode,
    pendingWrites: state.pendingWrites,
    executedWrites: state.executedWrites,
    stopReason,
    conversationId,
    pendingActions,
  };
}

