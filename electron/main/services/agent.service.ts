import { z } from 'zod';
import { aiConfigService } from './ai-config.service.js';
import { generateEmbeddingSingle } from './embedding.service.js';
import { getErrorMessage } from './error.service.js';
import { ragService } from './rag.service.js';
import {
  remoteAiService,
  type AiChatMessage,
  type AiChatTool,
  type AiChatToolCall,
} from './remote-ai.service.js';
import { assessRagEvidence } from './rag-evidence-assessment.service.js';
import { vfsService } from './vfs.service.js';
import { VFS_CONSTANTS } from '../constants/vfs.constants.js';
import { buildAgentSystemPrompt as buildAgentPromptTemplate } from '../prompts/index.js';
import { $t } from '../utils/i18n.js';

const AGENT_MAX_TOOL_ITERATIONS = 5;
const AGENT_MAX_TOOL_CALLS = 8;
const AGENT_MAX_CONSECUTIVE_TOOL_FAILURES = 2;
const AGENT_MAX_WEAK_SEARCHES = 2;
const AGENT_MAX_RUNTIME_MS = 45000;
const AGENT_TOOL_CONTENT_LIMIT = 1800;
const AGENT_NOTE_CONTENT_LIMIT = 6000;

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

type RagSearchResults = Awaited<ReturnType<typeof ragService.searchByVector>>;
type RagConfig = Awaited<ReturnType<typeof aiConfigService.resolveRagConfig>>;

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
  | 'iteration-limit'
  | 'runtime-limit'
  | 'tool-failure-limit'
  | 'weak-search-limit';

export interface KnowledgeAgentTaskResult {
  success: boolean;
  finalAnswer?: string;
  steps: KnowledgeAgentStep[];
  traceEvents: KnowledgeAgentTraceEvent[];
  sources: RagSearchResults;
  writeMode: KnowledgeAgentWriteMode;
  pendingWrites: KnowledgeAgentWriteProposal[];
  executedWrites: KnowledgeAgentExecutedWrite[];
  stopReason?: KnowledgeAgentStopReason;
  error?: string;
}

interface AgentExecutionState {
  sources: RagSearchResults;
  pendingWrites: KnowledgeAgentWriteProposal[];
  executedWrites: KnowledgeAgentExecutedWrite[];
  steps: KnowledgeAgentStep[];
  traceEvents: KnowledgeAgentTraceEvent[];
  toolCallCount: number;
  consecutiveToolFailures: number;
  weakSearchCount: number;
  startedAt: number;
  lastSearchHadSufficientEvidence: boolean | null;
  hadSufficientEvidence: boolean;
}

interface AgentToolDefinition {
  tool: AiChatTool;
  execute(args: unknown, ragConfig: RagConfig, state: AgentExecutionState): Promise<string>;
}

interface RunKnowledgeAgentTaskOptions {
  writeMode?: KnowledgeAgentWriteMode;
}

async function ensureRagReady(): Promise<RagConfig> {
  const ragConfig = await aiConfigService.resolveRagConfig();

  if (!ragService.isReady()) {
    await ragService.initialize(ragConfig.workspaceRoot, ragConfig.embeddingConfig);
  } else {
    ragService.updateEmbeddingConfig(ragConfig.embeddingConfig);
  }

  return ragConfig;
}

function limitText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}...`;
}

function parseToolArguments(toolCall: AiChatToolCall): unknown {
  const rawArguments = toolCall.function.arguments.trim();
  if (!rawArguments) {
    return {};
  }

  return JSON.parse(rawArguments) as unknown;
}

function createToolResponse(payload: Record<string, unknown>): string {
  return JSON.stringify(payload);
}

function createInsufficientEvidenceMessage(): string {
  return $t(
    'search.ragInsufficientEvidence',
    'The current knowledge base does not contain enough evidence to answer this question.',
  );
}

function createWriteBlockedMessage(): string {
  return $t(
    'search.agentWriteBlockedInsufficientEvidence',
    'Current evidence is insufficient to perform a write action.',
  );
}

function parseToolResponseMetadata(result: string): {
  success: boolean;
  insufficientEvidence: boolean;
} {
  try {
    const parsed = JSON.parse(result) as { success?: unknown; insufficientEvidence?: unknown };
    return {
      success: parsed.success !== false,
      insufficientEvidence: parsed.insufficientEvidence === true,
    };
  } catch {
    return {
      success: true,
      insufficientEvidence: false,
    };
  }
}

function createTraceEvent(
  state: AgentExecutionState,
  event: Omit<KnowledgeAgentTraceEvent, 'id' | 'at'> & { at?: number },
): void {
  state.traceEvents.push({
    id: `agent-trace-${Date.now()}-${state.traceEvents.length}`,
    at: event.at ?? Date.now(),
    ...event,
  });
}

function recordAgentStop(
  state: AgentExecutionState,
  stopReason: KnowledgeAgentStopReason,
  detail: string,
): KnowledgeAgentStopReason {
  state.steps.push({
    title: 'agentStop',
    detail,
    status: 'failed',
  });
  createTraceEvent(state, {
    type: 'tool-error',
    title: 'agentStop',
    detail,
    status: 'failed',
  });

  return stopReason;
}

function hasRuntimeLimitExceeded(state: AgentExecutionState): boolean {
  return Date.now() - state.startedAt >= AGENT_MAX_RUNTIME_MS;
}

function ensureWriteEvidenceAllowed(state: AgentExecutionState): void {
  if (state.lastSearchHadSufficientEvidence === false) {
    throw new Error(createWriteBlockedMessage());
  }
}

function buildForcedFinalInstruction(stopReason: KnowledgeAgentStopReason): string {
  switch (stopReason) {
    case 'insufficient-evidence':
    case 'weak-search-limit':
      return 'Provide the final answer now without calling any more tools. State clearly that the current knowledge base does not contain enough evidence to complete the request. Do not make strong claims.';
    case 'tool-failure-limit':
      return 'Provide the final answer now without calling any more tools. Explain briefly that tool execution stopped after repeated failures and answer conservatively using only reliable evidence already collected.';
    case 'tool-call-limit':
      return 'Provide the final answer now without calling any more tools. Explain briefly that execution stopped after reaching the tool call limit and answer conservatively using only the evidence already collected.';
    case 'runtime-limit':
      return 'Provide the final answer now without calling any more tools. Explain briefly that execution stopped after reaching the runtime limit and answer conservatively using only the evidence already collected.';
    case 'iteration-limit':
      return 'Provide the final answer now without calling any more tools. Explain briefly that execution stopped after reaching the iteration limit and answer conservatively using only the evidence already collected.';
    default:
      return 'Provide the final answer now without calling any more tools.';
  }
}

function addUniqueSources(target: RagSearchResults, nextSources: RagSearchResults): void {
  const existingIds = new Set(target.map((source) => source.chunk.id));

  nextSources.forEach((source) => {
    if (existingIds.has(source.chunk.id)) {
      return;
    }

    target.push(source);
    existingIds.add(source.chunk.id);
  });
}

function getActiveNoteNode(noteId: string) {
  return vfsService.getAllNodes().find((node) => (
    node.id === noteId
    && node.type === VFS_CONSTANTS.NODE_TYPE_FILE
    && !node.trashed
    && typeof node.contentId === 'string'
  ));
}

async function executeSearchKnowledgeBaseTool(
  args: unknown,
  ragConfig: RagConfig,
  state: AgentExecutionState,
): Promise<string> {
  const validated = SearchKnowledgeBaseToolArgsSchema.parse(args);
  const queryEmbedding = await generateEmbeddingSingle(validated.query, ragConfig.embeddingConfig);
  const results = await ragService.searchByVector({
    queryEmbedding,
    topK: Number(ragConfig.rag.topK),
    similarityThreshold: Number(ragConfig.rag.similarityThreshold),
  });
  const evidence = assessRagEvidence(results);

  addUniqueSources(state.sources, results);
  state.lastSearchHadSufficientEvidence = evidence.sufficient;
  if (evidence.sufficient) {
    state.hadSufficientEvidence = true;
    state.steps.push({
      title: 'searchKnowledgeBase',
      detail: `${results.length}`,
      status: 'completed',
    });
  } else {
    state.steps.push({
      title: 'searchKnowledgeBase',
      detail: createInsufficientEvidenceMessage(),
      status: 'failed',
    });
  }

  const toolResults = results.map((result) => ({
    noteId: result.chunk.noteId,
    noteTitle: result.noteTitle ?? '',
    score: result.score,
    content: limitText(result.chunk.content, AGENT_TOOL_CONTENT_LIMIT),
  }));

  if (!evidence.sufficient) {
    return createToolResponse({
      success: false,
      insufficientEvidence: true,
      error: createInsufficientEvidenceMessage(),
      results: toolResults,
    });
  }

  return createToolResponse({
    success: true,
    results: toolResults,
  });
}

async function executeListRecentNotesTool(
  args: unknown,
  _ragConfig: RagConfig,
  _state: AgentExecutionState,
): Promise<string> {
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

  return createToolResponse({
    success: true,
    notes,
  });
}

async function executeReadNoteTool(
  args: unknown,
  _ragConfig: RagConfig,
  state: AgentExecutionState,
): Promise<string> {
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
}

async function executeProposeCreateNoteTool(
  args: unknown,
  _ragConfig: RagConfig,
  state: AgentExecutionState,
): Promise<string> {
  ensureWriteEvidenceAllowed(state);
  const validated = ProposeCreateNoteToolArgsSchema.parse(args);
  const proposal: KnowledgeAgentCreateNoteProposal = {
    id: `agent-write-${Date.now()}-${state.pendingWrites.length}`,
    type: 'create-note',
    title: validated.title.trim(),
    content: validated.content.trim(),
    reason: validated.reason.trim(),
  };

  state.pendingWrites.push(proposal);
  state.steps.push({
    title: 'proposeCreateNote',
    detail: proposal.title,
    status: 'completed',
  });

  return createToolResponse({
    success: true,
    proposal,
  });
}

async function executeProposeUpdateNoteTool(
  args: unknown,
  _ragConfig: RagConfig,
  state: AgentExecutionState,
): Promise<string> {
  ensureWriteEvidenceAllowed(state);
  const validated = ProposeUpdateNoteToolArgsSchema.parse(args);
  const node = getActiveNoteNode(validated.noteId);

  if (!node) {
    throw new Error(`Note not found: ${validated.noteId}`);
  }

  const proposal: KnowledgeAgentUpdateNoteProposal = {
    id: `agent-write-${Date.now()}-${state.pendingWrites.length}`,
    type: 'update-note',
    noteId: node.id,
    noteTitle: node.name,
    content: validated.content.trim(),
    reason: validated.reason.trim(),
  };

  state.pendingWrites.push(proposal);
  state.steps.push({
    title: 'proposeUpdateNote',
    detail: proposal.noteTitle,
    status: 'completed',
  });

  return createToolResponse({
    success: true,
    proposal,
  });
}

async function executeCreateNoteTool(
  args: unknown,
  _ragConfig: RagConfig,
  state: AgentExecutionState,
): Promise<string> {
  ensureWriteEvidenceAllowed(state);
  const validated = ProposeCreateNoteToolArgsSchema.parse(args);
  const node = await vfsService.createFile(null, validated.title.trim(), validated.content.trim());
  const executedWrite: KnowledgeAgentExecutedCreateNote = {
    id: `agent-write-${Date.now()}-${state.executedWrites.length}`,
    type: 'create-note',
    noteId: node.id,
    noteTitle: node.name,
    content: validated.content.trim(),
    reason: validated.reason.trim(),
  };

  state.executedWrites.push(executedWrite);
  state.steps.push({
    title: 'createNote',
    detail: executedWrite.noteTitle,
    status: 'completed',
  });

  return createToolResponse({
    success: true,
    note: {
      noteId: executedWrite.noteId,
      noteTitle: executedWrite.noteTitle,
    },
  });
}

async function executeUpdateNoteTool(
  args: unknown,
  _ragConfig: RagConfig,
  state: AgentExecutionState,
): Promise<string> {
  ensureWriteEvidenceAllowed(state);
  const validated = ProposeUpdateNoteToolArgsSchema.parse(args);
  const node = getActiveNoteNode(validated.noteId);

  if (!node?.contentId) {
    throw new Error(`Note not found: ${validated.noteId}`);
  }

  await vfsService.writeContent(node.contentId, validated.content.trim());
  const executedWrite: KnowledgeAgentExecutedUpdateNote = {
    id: `agent-write-${Date.now()}-${state.executedWrites.length}`,
    type: 'update-note',
    noteId: node.id,
    noteTitle: node.name,
    content: validated.content.trim(),
    reason: validated.reason.trim(),
  };

  state.executedWrites.push(executedWrite);
  state.steps.push({
    title: 'updateNote',
    detail: executedWrite.noteTitle,
    status: 'completed',
  });

  return createToolResponse({
    success: true,
    note: {
      noteId: executedWrite.noteId,
      noteTitle: executedWrite.noteTitle,
    },
  });
}

const BASE_AGENT_TOOL_DEFINITIONS: AgentToolDefinition[] = [
  {
    tool: {
      type: 'function',
      function: {
        name: 'searchKnowledgeBase',
        description: 'Search the user knowledge base for note chunks relevant to the current task.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The semantic search query to run against the knowledge base.',
            },
          },
          required: ['query'],
          additionalProperties: false,
        },
      },
    },
    execute: executeSearchKnowledgeBaseTool,
  },
  {
    tool: {
      type: 'function',
      function: {
        name: 'listRecentNotes',
        description: 'List recent active notes by update time without reading full note content.',
        parameters: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of recent notes to return.',
            },
          },
          required: [],
          additionalProperties: false,
        },
      },
    },
    execute: executeListRecentNotesTool,
  },
  {
    tool: {
      type: 'function',
      function: {
        name: 'readNote',
        description: 'Read the full content of a note by noteId.',
        parameters: {
          type: 'object',
          properties: {
            noteId: {
              type: 'string',
              description: 'The note id to read.',
            },
          },
          required: ['noteId'],
          additionalProperties: false,
        },
      },
    },
    execute: executeReadNoteTool,
  },
];

const AGENT_CONFIRM_WRITE_TOOL_DEFINITIONS: AgentToolDefinition[] = [
  {
    tool: {
      type: 'function',
      function: {
        name: 'proposeCreateNote',
        description: 'Prepare a note creation proposal. This does not write any file and requires user confirmation later.',
        parameters: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'The proposed note title.',
            },
            content: {
              type: 'string',
              description: 'The proposed note Markdown content.',
            },
            reason: {
              type: 'string',
              description: 'Why this note should be created.',
            },
          },
          required: ['title', 'content', 'reason'],
          additionalProperties: false,
        },
      },
    },
    execute: executeProposeCreateNoteTool,
  },
  {
    tool: {
      type: 'function',
      function: {
        name: 'proposeUpdateNote',
        description: 'Prepare a full-content note update proposal. This does not write any file and requires user confirmation later.',
        parameters: {
          type: 'object',
          properties: {
            noteId: {
              type: 'string',
              description: 'The note id to update.',
            },
            content: {
              type: 'string',
              description: 'The proposed full replacement Markdown content.',
            },
            reason: {
              type: 'string',
              description: 'Why this note should be updated.',
            },
          },
          required: ['noteId', 'content', 'reason'],
          additionalProperties: false,
        },
      },
    },
    execute: executeProposeUpdateNoteTool,
  },
];

const AGENT_AUTO_WRITE_TOOL_DEFINITIONS: AgentToolDefinition[] = [
  {
    tool: {
      type: 'function',
      function: {
        name: 'createNote',
        description: 'Create a new note immediately in the workspace root.',
        parameters: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'The new note title.',
            },
            content: {
              type: 'string',
              description: 'The new note Markdown content.',
            },
            reason: {
              type: 'string',
              description: 'Why this note should be created.',
            },
          },
          required: ['title', 'content', 'reason'],
          additionalProperties: false,
        },
      },
    },
    execute: executeCreateNoteTool,
  },
  {
    tool: {
      type: 'function',
      function: {
        name: 'updateNote',
        description: 'Replace the full content of an existing note immediately.',
        parameters: {
          type: 'object',
          properties: {
            noteId: {
              type: 'string',
              description: 'The note id to update.',
            },
            content: {
              type: 'string',
              description: 'The full replacement Markdown content.',
            },
            reason: {
              type: 'string',
              description: 'Why this note should be updated.',
            },
          },
          required: ['noteId', 'content', 'reason'],
          additionalProperties: false,
        },
      },
    },
    execute: executeUpdateNoteTool,
  },
];

function getAgentToolDefinitions(writeMode: KnowledgeAgentWriteMode): AgentToolDefinition[] {
  return [
    ...BASE_AGENT_TOOL_DEFINITIONS,
    ...(writeMode === 'auto'
      ? AGENT_AUTO_WRITE_TOOL_DEFINITIONS
      : AGENT_CONFIRM_WRITE_TOOL_DEFINITIONS),
  ];
}

async function executeAgentTool(
  toolCall: AiChatToolCall,
  ragConfig: RagConfig,
  state: AgentExecutionState,
  toolMap: Map<string, AgentToolDefinition>,
): Promise<{ content: string; success: boolean; insufficientEvidence: boolean }> {
  const startedAt = Date.now();
  const toolName = toolCall.function.name;

  try {
    const args = parseToolArguments(toolCall);
    createTraceEvent(state, {
      type: 'tool-call',
      title: toolName,
      detail: limitText(toolCall.function.arguments, 500),
      status: 'completed',
      toolName,
      at: startedAt,
    });

    const toolDefinition = toolMap.get(toolName);
    if (!toolDefinition) {
      throw new Error(`Unknown agent tool: ${toolName}`);
    }

    const result = await toolDefinition.execute(args, ragConfig, state);
    const metadata = parseToolResponseMetadata(result);
    createTraceEvent(state, {
      type: 'tool-result',
      title: toolName,
      detail: limitText(result, 800),
      status: metadata.success ? 'completed' : 'failed',
      toolName,
      at: startedAt,
      durationMs: Date.now() - startedAt,
    });

    return {
      content: result,
      success: metadata.success,
      insufficientEvidence: metadata.insufficientEvidence,
    };
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

    return {
      content: createToolResponse({
        success: false,
        error: message,
      }),
      success: false,
      insufficientEvidence: false,
    };
  }
}

export async function runKnowledgeAgentTask(
  task: string,
  options: RunKnowledgeAgentTaskOptions = {},
): Promise<KnowledgeAgentTaskResult> {
  const writeMode = options.writeMode === 'auto' ? 'auto' : 'confirm';
  const ragConfig = await ensureRagReady();
  const agentToolDefinitions = getAgentToolDefinitions(writeMode);
  const agentTools = agentToolDefinitions.map((definition) => definition.tool);
  const agentToolMap = new Map(
    agentToolDefinitions.map((definition) => [definition.tool.function.name, definition]),
  );
  const state: AgentExecutionState = {
    sources: [],
    pendingWrites: [],
    executedWrites: [],
    steps: [],
    traceEvents: [],
    toolCallCount: 0,
    consecutiveToolFailures: 0,
    weakSearchCount: 0,
    startedAt: Date.now(),
    lastSearchHadSufficientEvidence: null,
    hadSufficientEvidence: false,
  };

  if (!ragConfig.chatConfig) {
    return {
      success: false,
      error: 'Chat model is not configured for agent tasks.',
      finalAnswer: undefined,
      steps: [
        {
          title: 'configureChatModel',
          detail: 'missing',
          status: 'failed',
        },
      ],
      traceEvents: [],
      sources: [],
      writeMode,
      pendingWrites: [],
      executedWrites: [],
      stopReason: undefined,
    };
  }

  const messages: AiChatMessage[] = [
    { role: 'system', content: buildAgentPromptTemplate(writeMode, ragConfig.uiLanguage, task) },
    { role: 'user', content: task },
  ];
  let stopReason: KnowledgeAgentStopReason | undefined;

  for (let iteration = 0; iteration < AGENT_MAX_TOOL_ITERATIONS; iteration += 1) {
    if (hasRuntimeLimitExceeded(state)) {
      stopReason = recordAgentStop(state, 'runtime-limit', 'runtime-limit');
      break;
    }

    const modelStartedAt = Date.now();
    const response = await remoteAiService.chat({
      endpoint: ragConfig.chatConfig.endpoint,
      apiKey: ragConfig.chatConfig.apiKey,
      model: ragConfig.chatConfig.model,
      messages,
      tools: agentTools,
      tool_choice: 'auto',
      temperature: 0.4,
      max_tokens: 1400,
    });

    const assistantMessage = response.choices?.[0]?.message;
    if (!assistantMessage) {
      throw new Error('Agent model returned an empty response.');
    }

    const toolCalls = assistantMessage.tool_calls ?? [];
    createTraceEvent(state, {
      type: 'model-response',
      title: 'modelResponse',
      detail: `${toolCalls.length}`,
      status: 'completed',
      at: modelStartedAt,
      durationMs: Date.now() - modelStartedAt,
    });

    if (toolCalls.length === 0) {
      const finalAnswer = state.lastSearchHadSufficientEvidence === false && !state.hadSufficientEvidence
        ? createInsufficientEvidenceMessage()
        : (assistantMessage.content?.trim() || 'Agent task completed.');
      return {
        success: true,
        finalAnswer,
        steps: state.steps,
        traceEvents: state.traceEvents,
        sources: state.sources,
        writeMode,
        pendingWrites: state.pendingWrites,
        executedWrites: state.executedWrites,
        stopReason: state.lastSearchHadSufficientEvidence === false && !state.hadSufficientEvidence
          ? 'insufficient-evidence'
          : 'completed',
      };
    }

    if (state.toolCallCount + toolCalls.length > AGENT_MAX_TOOL_CALLS) {
      stopReason = recordAgentStop(state, 'tool-call-limit', 'tool-call-limit');
      break;
    }

    messages.push({
      role: 'assistant',
      content: assistantMessage.content ?? null,
      tool_calls: toolCalls,
    });

    for (const toolCall of toolCalls) {
      state.toolCallCount += 1;
      const toolResult = await executeAgentTool(toolCall, ragConfig, state, agentToolMap);
      if (!toolResult.success) {
        state.consecutiveToolFailures += 1;
      } else {
        state.consecutiveToolFailures = 0;
      }
      if (toolCall.function.name === 'searchKnowledgeBase') {
        if (toolResult.insufficientEvidence) {
          state.weakSearchCount += 1;
        } else if (toolResult.success) {
          state.weakSearchCount = 0;
        }
      }
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: toolResult.content,
      });

      if (state.weakSearchCount >= AGENT_MAX_WEAK_SEARCHES) {
        stopReason = recordAgentStop(state, 'weak-search-limit', 'weak-search-limit');
        break;
      }

      if (state.consecutiveToolFailures >= AGENT_MAX_CONSECUTIVE_TOOL_FAILURES) {
        stopReason = recordAgentStop(state, 'tool-failure-limit', 'tool-failure-limit');
        break;
      }

      if (hasRuntimeLimitExceeded(state)) {
        stopReason = recordAgentStop(state, 'runtime-limit', 'runtime-limit');
        break;
      }
    }

    if (stopReason) {
      break;
    }
  }

  if (!stopReason) {
    stopReason = recordAgentStop(state, 'iteration-limit', 'iteration-limit');
  }

  const finalResponse = await remoteAiService.chat({
    endpoint: ragConfig.chatConfig.endpoint,
    apiKey: ragConfig.chatConfig.apiKey,
    model: ragConfig.chatConfig.model,
    messages: [
      ...messages,
      {
        role: 'user',
        content: buildForcedFinalInstruction(stopReason),
      },
    ],
    tools: agentTools,
    tool_choice: 'none',
    temperature: 0.4,
    max_tokens: 1000,
  });

  return {
    success: true,
    finalAnswer: finalResponse.choices?.[0]?.message?.content?.trim() || 'Agent task completed.',
    steps: state.steps,
    traceEvents: state.traceEvents,
    sources: state.sources,
    writeMode,
    pendingWrites: state.pendingWrites,
    executedWrites: state.executedWrites,
    stopReason,
  };
}
