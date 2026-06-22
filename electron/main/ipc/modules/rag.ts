/**
 * RAG IPC Handlers
 * Handles communication between renderer and main process for RAG operations
 */

import { ipcMain } from 'electron';
import { z } from 'zod';
import { ragService } from '../../services/rag.service.js';
import { runKnowledgeAgentTask } from '../../services/agent.service.js';
import { remoteAiService } from '../../services/remote-ai.service.js';
import { aiConfigService } from '../../services/ai-config.service.js';
import { IPC_CHANNELS } from '../../constants/ipc.constants.js';
import { loggerService } from '../../services/logger.service.js';
import { getErrorMessage } from '../../services/error.service.js';
import { LICENSE_RUNTIME_FEATURES, licenseService } from '../../services/license.service.js';
import { assessRagEvidence } from '../../services/rag-evidence-assessment.service.js';
import { buildRagAnswerPrompt } from '../../prompts/index.js';
import { $t } from '../../utils/i18n.js';

const logger = loggerService.createLogger('Main:RAG IPC');

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
  writeMode: z.enum(['confirm', 'auto']).optional(),
});

type RagSearchResults = Awaited<ReturnType<typeof ragService.searchByVector>>;

interface KnowledgeAnswerResult {
  success: boolean;
  answer?: string;
  sources: RagSearchResults;
  usedSearchFallback: boolean;
  insufficientEvidence?: boolean;
  error?: string;
}

function createInsufficientEvidenceMessage(): string {
  return $t(
    'search.ragInsufficientEvidence',
    'The current knowledge base does not contain enough evidence to answer this question.',
  );
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

async function answerKnowledgeQuestion(query: string): Promise<KnowledgeAnswerResult> {
  const ragConfig = await ensureRagReady();
  const results = await ragService.searchKnowledgeBase({
    query,
    topK: Number(ragConfig.rag.topK),
    similarityThreshold: Number(ragConfig.rag.similarityThreshold),
    rerankerConfig: ragConfig.rerankerConfig,
  });

  if (!results.length) {
    return {
      success: false,
      error: createInsufficientEvidenceMessage(),
      sources: [],
      usedSearchFallback: false,
      insufficientEvidence: true,
    };
  }

  const evidence = assessRagEvidence(results);
  if (!evidence.sufficient) {
    logger.info('RAG answer rejected due to insufficient evidence', {
      highestScore: evidence.highestScore,
      averageScore: evidence.averageScore,
      consideredCount: evidence.consideredCount,
    });
    return {
      success: false,
      error: createInsufficientEvidenceMessage(),
      sources: results,
      usedSearchFallback: false,
      insufficientEvidence: true,
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
  const systemPrompt = buildRagAnswerPrompt(ragConfig.uiLanguage, query, contextText);

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
      return {
        success: false,
        error: message,
        sources: [],
        usedSearchFallback: false,
        insufficientEvidence: false,
      };
    }
  });

  ipcMain.handle(IPC_CHANNELS.RAG_RUN_TASK, async (_event, request) => {
    try {
      licenseService.ensureFeatureEnabled(LICENSE_RUNTIME_FEATURES.RAG);
      const validated = RunTaskSchema.parse(request);
      return await runKnowledgeAgentTask(validated.task, { writeMode: validated.writeMode });
    } catch (error) {
      const message = getErrorMessage(error);
      logger.error(`RAG_RUN_TASK error: ${message}`);
      return {
        success: false,
        error: message,
        finalAnswer: undefined,
        steps: [],
        traceEvents: [],
        sources: [],
        writeMode: 'confirm',
        pendingWrites: [],
        executedWrites: [],
        stopReason: undefined,
      };
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
