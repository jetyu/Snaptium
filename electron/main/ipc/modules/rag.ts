/**
 * RAG IPC Handlers
 * Handles communication between renderer and main process for RAG operations
 */

import { ipcMain } from 'electron';
import { z } from 'zod';
import { ragService } from '../../services/rag.service.js';
import { generateEmbeddingSingle } from '../../services/embedding.service.js';
import {
  remoteAiService,
  type AiChatMessage,
  type AiChatTool,
  type AiChatToolCall,
} from '../../services/remote-ai.service.js';
import { aiConfigService } from '../../services/ai-config.service.js';
import { IPC_CHANNELS } from '../../constants/ipc.constants.js';
import { loggerService } from '../../services/logger.service.js';
import { getErrorMessage } from '../../services/error.service.js';
import { LICENSE_RUNTIME_FEATURES, licenseService } from '../../services/license.service.js';

const logger = loggerService.createLogger('Main:RAG IPC');
const AGENT_MAX_TOOL_ITERATIONS = 5;
const AGENT_TOOL_CONTENT_LIMIT = 1800;

const InitializeSchema = z.object({}).optional();

const IndexNoteSchema = z.object({
  noteId: z.string().min(1),
  noteTitle: z.string().min(1),
  content: z.string(),
  chunkSize: z.number().int().positive().optional().default(500),
  chunkOverlap: z.number().int().nonnegative().optional().default(50),
});

const AskQuestionSchema = z.object({
  query: z.string().min(1),
});

const RunTaskSchema = z.object({
  task: z.string().min(1),
});

const SearchKnowledgeBaseToolArgsSchema = z.object({
  query: z.string().min(1),
});

const ProposeCreateNoteToolArgsSchema = z.object({
  title: z.string().min(1).max(120),
  content: z.string().min(1).max(12000),
  reason: z.string().min(1).max(500),
});

const AGENT_TOOLS: AiChatTool[] = [
  {
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
  {
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
];

type RagSearchResults = Awaited<ReturnType<typeof ragService.searchByVector>>;
type RagConfig = Awaited<ReturnType<typeof aiConfigService.resolveRagConfig>>;

interface KnowledgeAnswerResult {
  success: boolean;
  answer?: string;
  sources: RagSearchResults;
  usedSearchFallback: boolean;
  error?: string;
}

interface KnowledgeAgentStep {
  title: string;
  detail: string;
  status: 'completed' | 'failed';
}

interface KnowledgeAgentWriteProposal {
  id: string;
  type: 'create-note';
  title: string;
  content: string;
  reason: string;
}

interface KnowledgeAgentTaskResult {
  success: boolean;
  finalAnswer?: string;
  steps: KnowledgeAgentStep[];
  sources: RagSearchResults;
  pendingWrites: KnowledgeAgentWriteProposal[];
  error?: string;
}

interface AgentExecutionState {
  sources: RagSearchResults;
  pendingWrites: KnowledgeAgentWriteProposal[];
  steps: KnowledgeAgentStep[];
}

async function ensureRagReady(): Promise<Awaited<ReturnType<typeof aiConfigService.resolveRagConfig>>> {
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

  addUniqueSources(state.sources, results);
  state.steps.push({
    title: 'Search knowledge base',
    detail: `Found ${results.length} relevant chunks.`,
    status: 'completed',
  });

  return createToolResponse({
    success: true,
    results: results.map((result) => ({
      noteId: result.chunk.noteId,
      noteTitle: result.noteTitle ?? '',
      score: result.score,
      content: limitText(result.chunk.content, AGENT_TOOL_CONTENT_LIMIT),
    })),
  });
}

function executeProposeCreateNoteTool(args: unknown, state: AgentExecutionState): string {
  const validated = ProposeCreateNoteToolArgsSchema.parse(args);
  const proposal: KnowledgeAgentWriteProposal = {
    id: `agent-write-${Date.now()}-${state.pendingWrites.length}`,
    type: 'create-note',
    title: validated.title.trim(),
    content: validated.content.trim(),
    reason: validated.reason.trim(),
  };

  state.pendingWrites.push(proposal);
  state.steps.push({
    title: 'Prepare note proposal',
    detail: proposal.title,
    status: 'completed',
  });

  return createToolResponse({
    success: true,
    proposal,
  });
}

async function executeAgentTool(
  toolCall: AiChatToolCall,
  ragConfig: RagConfig,
  state: AgentExecutionState,
): Promise<string> {
  try {
    const args = parseToolArguments(toolCall);

    if (toolCall.function.name === 'searchKnowledgeBase') {
      return await executeSearchKnowledgeBaseTool(args, ragConfig, state);
    }

    if (toolCall.function.name === 'proposeCreateNote') {
      return executeProposeCreateNoteTool(args, state);
    }

    throw new Error(`Unknown agent tool: ${toolCall.function.name}`);
  } catch (error) {
    const message = getErrorMessage(error);
    state.steps.push({
      title: toolCall.function.name,
      detail: message,
      status: 'failed',
    });

    return createToolResponse({
      success: false,
      error: message,
    });
  }
}

function createAgentSystemPrompt(): string {
  return [
    'You are Snaptium Agent, an assistant for a local-first note workspace.',
    '',
    'You can use tools to inspect the user knowledge base and prepare safe write proposals.',
    '',
    'Rules:',
    '1. Use searchKnowledgeBase before answering tasks that require knowledge from notes.',
    '2. Use proposeCreateNote only when creating a new note would help the user.',
    '3. Never claim a note has been created or modified. Write proposals require user confirmation.',
    '4. Keep final answers direct, practical, and in the same language as the user task.',
    '5. If tool results are insufficient, say what is missing.',
  ].join('\n');
}

async function runKnowledgeAgentTask(task: string): Promise<KnowledgeAgentTaskResult> {
  const ragConfig = await ensureRagReady();
  const state: AgentExecutionState = {
    sources: [],
    pendingWrites: [],
    steps: [],
  };

  if (!ragConfig.chatConfig) {
    return {
      success: false,
      error: 'Chat model is not configured for agent tasks.',
      finalAnswer: undefined,
      steps: [
        {
          title: 'Configure chat model',
          detail: 'Agent tasks require an available chat model.',
          status: 'failed',
        },
      ],
      sources: [],
      pendingWrites: [],
    };
  }

  const messages: AiChatMessage[] = [
    { role: 'system', content: createAgentSystemPrompt() },
    { role: 'user', content: task },
  ];

  for (let iteration = 0; iteration < AGENT_MAX_TOOL_ITERATIONS; iteration += 1) {
    const response = await remoteAiService.chat({
      endpoint: ragConfig.chatConfig.endpoint,
      apiKey: ragConfig.chatConfig.apiKey,
      model: ragConfig.chatConfig.model,
      messages,
      tools: AGENT_TOOLS,
      tool_choice: 'auto',
      temperature: 0.4,
      max_tokens: 1400,
    });

    const assistantMessage = response.choices?.[0]?.message;
    if (!assistantMessage) {
      throw new Error('Agent model returned an empty response.');
    }

    const toolCalls = assistantMessage.tool_calls ?? [];
    if (toolCalls.length === 0) {
      const finalAnswer = assistantMessage.content?.trim() || 'Agent task completed.';
      return {
        success: true,
        finalAnswer,
        steps: state.steps,
        sources: state.sources,
        pendingWrites: state.pendingWrites,
      };
    }

    messages.push({
      role: 'assistant',
      content: assistantMessage.content ?? null,
      tool_calls: toolCalls,
    });

    for (const toolCall of toolCalls) {
      const toolResult = await executeAgentTool(toolCall, ragConfig, state);
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: toolResult,
      });
    }
  }

  const finalResponse = await remoteAiService.chat({
    endpoint: ragConfig.chatConfig.endpoint,
    apiKey: ragConfig.chatConfig.apiKey,
    model: ragConfig.chatConfig.model,
    messages: [
      ...messages,
      {
        role: 'user',
        content: 'Provide the final answer now without calling any more tools.',
      },
    ],
    tools: AGENT_TOOLS,
    tool_choice: 'none',
    temperature: 0.4,
    max_tokens: 1000,
  });

  return {
    success: true,
    finalAnswer: finalResponse.choices?.[0]?.message?.content?.trim() || 'Agent task completed.',
    steps: state.steps,
    sources: state.sources,
    pendingWrites: state.pendingWrites,
  };
}

async function answerKnowledgeQuestion(query: string): Promise<KnowledgeAnswerResult> {
  const ragConfig = await ensureRagReady();
  const queryEmbedding = await generateEmbeddingSingle(query, ragConfig.embeddingConfig);
  const results = await ragService.searchByVector({
    queryEmbedding,
    topK: Number(ragConfig.rag.topK),
    similarityThreshold: Number(ragConfig.rag.similarityThreshold),
  });

  if (!results.length) {
    return {
      success: false,
      error: 'No relevant context found in notes',
      sources: [],
      usedSearchFallback: false,
    };
  }

  if (!ragConfig.chatConfig) {
    const summary = results
      .map((res, idx) => `[${idx + 1}] ${res.noteTitle || 'Untitled'}:\n${res.chunk.content}`)
      .join('\n\n');

    return {
      success: true,
      answer: summary,
      sources: results,
      usedSearchFallback: true,
    };
  }

  const contextText = results.map((res) => res.chunk.content).join('\n---\n');
  const systemPrompt = [
    'You are a professional note assistant. Answer concisely and accurately based only on the provided note context.',
    '',
    'Rules:',
    '1. Use only the provided note content.',
    '2. Answer directly with clear conclusions and key points.',
    '3. Do not introduce external knowledge that is not present in the notes.',
    '',
    'Note context:',
    contextText,
  ].join('\n');

  const response = await remoteAiService.chat({
    endpoint: ragConfig.chatConfig.endpoint,
    apiKey: ragConfig.chatConfig.apiKey,
    model: ragConfig.chatConfig.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: query },
    ],
    temperature: 0.7,
    max_tokens: 1000,
  });

  return {
    success: true,
    answer: response.choices?.[0]?.message?.content ?? undefined,
    sources: results,
    usedSearchFallback: false,
  };
}

export function registerRAGHandlers() {
  ipcMain.handle(IPC_CHANNELS.RAG_INITIALIZE, async (_event, request) => {
    try {
      licenseService.ensureFeatureEnabled(LICENSE_RUNTIME_FEATURES.RAG);
      InitializeSchema.parse(request);
      const ragConfig = await aiConfigService.resolveRagConfig();
      await ragService.initialize(ragConfig.workspaceRoot, ragConfig.embeddingConfig);
      return { success: true };
    } catch (error) {
      const message = getErrorMessage(error);
      logger.error(`RAG_INITIALIZE error: ${message}`);
      return { success: false, error: message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.RAG_INDEX_NOTE, async (_event, request) => {
    try {
      licenseService.ensureFeatureEnabled(LICENSE_RUNTIME_FEATURES.RAG);
      const validated = IndexNoteSchema.parse(request);
      return await ragService.indexNote(validated);
    } catch (error) {
      const message = getErrorMessage(error);
      logger.error(`RAG_INDEX_NOTE error: ${message}`);
      return { success: false, error: message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.RAG_ANSWER_QUESTION, async (_event, request) => {
    try {
      licenseService.ensureFeatureEnabled(LICENSE_RUNTIME_FEATURES.RAG);
      const validated = AskQuestionSchema.parse(request);
      return await answerKnowledgeQuestion(validated.query);
    } catch (error) {
      const message = getErrorMessage(error);
      logger.error(`RAG_ANSWER_QUESTION error: ${message}`);
      return { success: false, error: message, sources: [], usedSearchFallback: false };
    }
  });

  ipcMain.handle(IPC_CHANNELS.RAG_RUN_TASK, async (_event, request) => {
    try {
      licenseService.ensureFeatureEnabled(LICENSE_RUNTIME_FEATURES.RAG);
      const validated = RunTaskSchema.parse(request);
      return await runKnowledgeAgentTask(validated.task);
    } catch (error) {
      const message = getErrorMessage(error);
      logger.error(`RAG_RUN_TASK error: ${message}`);
      return { success: false, error: message, finalAnswer: undefined, steps: [], sources: [], pendingWrites: [] };
    }
  });

  ipcMain.handle(IPC_CHANNELS.RAG_DELETE_NOTE_INDEX, async (_event, noteId) => {
    try {
      licenseService.ensureFeatureEnabled(LICENSE_RUNTIME_FEATURES.RAG);
      z.string().parse(noteId);
      return await ragService.deleteNoteIndex(noteId);
    } catch (error) {
      const message = getErrorMessage(error);
      logger.error(`RAG_DELETE_NOTE_INDEX error: ${message}`);
      return { success: false, error: message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.RAG_GET_STATUS, async () => {
    try {
      licenseService.ensureFeatureEnabled(LICENSE_RUNTIME_FEATURES.RAG);
      const status = await ragService.getStatus();
      return { success: true, ...status };
    } catch (error) {
      const message = getErrorMessage(error);
      logger.error(`RAG_GET_STATUS error: ${message}`);
      return { success: false, error: message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.RAG_REBUILD_INDEX, async () => {
    try {
      licenseService.ensureFeatureEnabled(LICENSE_RUNTIME_FEATURES.RAG);
      await ragService.clear();
      return { success: true };
    } catch (error) {
      const message = getErrorMessage(error);
      logger.error(`RAG_REBUILD_INDEX error: ${message}`);
      return { success: false, error: message };
    }
  });

  logger.info('RAG IPC handlers registered');
}
