import { z } from 'zod';
import { createAgent, tool } from 'langchain';
import { ChatOpenAI } from '@langchain/openai';
import { getErrorMessage } from './error.service.js';
import { knowledgeAgentIndexService } from './knowledge-agent-index.service.js';
import { assessKnowledgeEvidence } from './knowledge-evidence-assessment.service.js';
import { ensureKnowledgeAgentReady } from './knowledge-agent-qa.service.js';
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

type KnowledgeSearchResults = Awaited<ReturnType<typeof knowledgeAgentIndexService.searchByVector>>;
type KnowledgeAgentConfig = Awaited<ReturnType<typeof ensureKnowledgeAgentReady>>;

export interface KnowledgeAgentStep {
  title: string;
  detail: string;
  status: 'completed' | 'failed';
}

export interface KnowledgeAgentTraceEvent {
  id: string;
  type: 'model-response' | 'tool-call' | 'tool-result' | 'tool-error';
  title: string;
  detail: string;
  status: 'completed' | 'failed';
  at: number;
  durationMs?: number;
  toolName?: string;
}

export interface KnowledgeAgentCreateNoteProposal {
  id: string;
  type: 'create-note';
  title: string;
  content: string;
  reason: string;
}

export interface KnowledgeAgentUpdateNoteProposal {
  id: string;
  type: 'update-note';
  noteId: string;
  noteTitle: string;
  content: string;
  reason: string;
}

export type KnowledgeAgentWriteProposal =
  | KnowledgeAgentCreateNoteProposal
  | KnowledgeAgentUpdateNoteProposal;

export type KnowledgeAgentWriteMode = 'confirm' | 'auto';

export interface KnowledgeAgentExecutedCreateNote {
  id: string;
  type: 'create-note';
  noteId: string;
  noteTitle: string;
  content: string;
  reason: string;
}

export interface KnowledgeAgentExecutedUpdateNote {
  id: string;
  type: 'update-note';
  noteId: string;
  noteTitle: string;
  content: string;
  reason: string;
}

export type KnowledgeAgentExecutedWrite =
  | KnowledgeAgentExecutedCreateNote
  | KnowledgeAgentExecutedUpdateNote;

export type KnowledgeAgentStopReason =
  | 'completed'
  | 'insufficient-evidence'
  | 'tool-call-limit'
  | 'tool-failure-limit';

export interface KnowledgeAgentTaskResult {
  success: boolean;
  finalAnswer?: string;
  steps: KnowledgeAgentStep[];
  traceEvents: KnowledgeAgentTraceEvent[];
  sources: KnowledgeSearchResults;
  writeMode: KnowledgeAgentWriteMode;
  pendingWrites: KnowledgeAgentWriteProposal[];
  executedWrites: KnowledgeAgentExecutedWrite[];
  stopReason?: KnowledgeAgentStopReason;
  error?: string;
}

interface AgentExecutionState {
  sources: KnowledgeSearchResults;
  pendingWrites: KnowledgeAgentWriteProposal[];
  executedWrites: KnowledgeAgentExecutedWrite[];
  steps: KnowledgeAgentStep[];
  traceEvents: KnowledgeAgentTraceEvent[];
  toolCallCount: number;
  lastSearchHadSufficientEvidence: boolean | null;
  hadSufficientEvidence: boolean;
}

interface RunKnowledgeAgentTaskOptions {
  writeMode?: KnowledgeAgentWriteMode;
}

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
    'search.knowledgeAgentInsufficientEvidence',
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
  event: Omit<KnowledgeAgentTraceEvent, 'id' | 'at'> & { at?: number },
): void {
  state.traceEvents.push({
    id: `knowledge-agent-trace-${Date.now()}-${state.traceEvents.length}`,
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

function endpointToOpenAIBaseUrl(endpoint: string): string {
  return endpoint.replace(/\/chat\/completions\/?$/, '').replace(/\/+$/, '');
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

function buildLangChainTools(config: KnowledgeAgentConfig, state: AgentExecutionState, writeMode: KnowledgeAgentWriteMode) {
  const searchKnowledgeBase = tool(
    async (args) => executeToolWithTrace(state, 'searchKnowledgeBase', args, async () => {
      const validated = SearchKnowledgeBaseToolArgsSchema.parse(args);
      const results = await knowledgeAgentIndexService.searchKnowledgeBase({
        query: validated.query,
        topK: Number(config.knowledgeAgent.topK),
        similarityThreshold: Number(config.knowledgeAgent.similarityThreshold),
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

  const proposeCreateNote = tool(
    async (args) => executeToolWithTrace(state, 'proposeCreateNote', args, async () => {
      ensureWriteEvidenceAllowed(state);
      const validated = ProposeCreateNoteToolArgsSchema.parse(args);
      const proposal: KnowledgeAgentCreateNoteProposal = {
        id: `knowledge-agent-write-${Date.now()}-${state.pendingWrites.length}`,
        type: 'create-note',
        title: validated.title.trim(),
        content: validated.content.trim(),
        reason: validated.reason.trim(),
      };
      state.pendingWrites.push(proposal);
      state.steps.push({ title: 'proposeCreateNote', detail: proposal.title, status: 'completed' });
      return createToolResponse({ success: true, proposal });
    }),
    {
      name: 'proposeCreateNote',
      description: 'Prepare a note creation proposal. This does not write any file and requires user confirmation later.',
      schema: ProposeCreateNoteToolArgsSchema,
    },
  );

  const proposeUpdateNote = tool(
    async (args) => executeToolWithTrace(state, 'proposeUpdateNote', args, async () => {
      ensureWriteEvidenceAllowed(state);
      const validated = ProposeUpdateNoteToolArgsSchema.parse(args);
      const node = getActiveNoteNode(validated.noteId);
      if (!node) {
        throw new Error(`Note not found: ${validated.noteId}`);
      }

      const proposal: KnowledgeAgentUpdateNoteProposal = {
        id: `knowledge-agent-write-${Date.now()}-${state.pendingWrites.length}`,
        type: 'update-note',
        noteId: node.id,
        noteTitle: node.name,
        content: validated.content.trim(),
        reason: validated.reason.trim(),
      };
      state.pendingWrites.push(proposal);
      state.steps.push({ title: 'proposeUpdateNote', detail: proposal.noteTitle, status: 'completed' });
      return createToolResponse({ success: true, proposal });
    }),
    {
      name: 'proposeUpdateNote',
      description: 'Prepare a full-content note update proposal. This does not write any file and requires user confirmation later.',
      schema: ProposeUpdateNoteToolArgsSchema,
    },
  );

  const createNote = tool(
    async (args) => executeToolWithTrace(state, 'createNote', args, async () => {
      ensureWriteEvidenceAllowed(state);
      const validated = ProposeCreateNoteToolArgsSchema.parse(args);
      const node = await vfsService.createFile(null, validated.title.trim(), validated.content.trim());
      const executedWrite: KnowledgeAgentExecutedCreateNote = {
        id: `knowledge-agent-write-${Date.now()}-${state.executedWrites.length}`,
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
      const executedWrite: KnowledgeAgentExecutedUpdateNote = {
        id: `knowledge-agent-write-${Date.now()}-${state.executedWrites.length}`,
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

  return writeMode === 'auto'
    ? [searchKnowledgeBase, listRecentNotes, readNote, createNote, updateNote]
    : [searchKnowledgeBase, listRecentNotes, readNote, proposeCreateNote, proposeUpdateNote];
}

export async function runKnowledgeAgentTask(
  task: string,
  options: RunKnowledgeAgentTaskOptions = {},
): Promise<KnowledgeAgentTaskResult> {
  const writeMode = options.writeMode === 'auto' ? 'auto' : 'confirm';
  const config = await ensureKnowledgeAgentReady();
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

  if (!config.chatConfig) {
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
    };
  }

  const llm = new ChatOpenAI({
    apiKey: config.chatConfig.apiKey,
    model: config.chatConfig.model,
    temperature: 0.4,
    maxTokens: 1400,
    configuration: {
      baseURL: endpointToOpenAIBaseUrl(config.chatConfig.endpoint),
    },
  });
  const agent = createAgent({
    model: llm,
    tools: buildLangChainTools(config, state, writeMode),
    systemPrompt: buildAgentSystemPrompt(writeMode, config.uiLanguage, task),
  });

  const startedAt = Date.now();
  const result = await agent.invoke({
    messages: [{ role: 'user', content: task }],
  });
  createTraceEvent(state, {
    type: 'model-response',
    title: 'modelResponse',
    detail: 'completed',
    status: 'completed',
    at: startedAt,
    durationMs: Date.now() - startedAt,
  });

  const stopReason: KnowledgeAgentStopReason = state.toolCallCount > AGENT_MAX_TOOL_CALLS
    ? 'tool-call-limit'
    : state.lastSearchHadSufficientEvidence === false && !state.hadSufficientEvidence
      ? 'insufficient-evidence'
      : 'completed';

  return {
    success: true,
    finalAnswer: stopReason === 'insufficient-evidence'
      ? createInsufficientEvidenceMessage()
      : extractFinalAnswer(result) || 'Agent task completed.',
    steps: state.steps,
    traceEvents: state.traceEvents,
    sources: state.sources,
    writeMode,
    pendingWrites: state.pendingWrites,
    executedWrites: state.executedWrites,
    stopReason,
  };
}

