/**
 * RAG IPC Handlers
 * Handles communication between renderer and main process for RAG operations
 */

import { ipcMain } from 'electron';
import { z } from 'zod';
import { ragService } from '../../services/rag.service.js';
import { generateEmbeddingSingle } from '../../services/embedding.service.js';
import { remoteAiService } from '../../services/remote-ai.service.js';
import { aiConfigService } from '../../services/ai-config.service.js';
import { IPC_CHANNELS } from '../../constants/ipc.constants.js';
import { loggerService } from '../../services/logger.service.js';
import { getErrorMessage } from '../../services/error.service.js';
import { LICENSE_RUNTIME_FEATURES, licenseService } from '../../services/license.service.js';

const logger = loggerService.createLogger('Main:RAG IPC');

// Validation Schemas
const InitializeSchema = z.object({}).optional();

const IndexNoteSchema = z.object({
  noteId: z.string().min(1),
  noteTitle: z.string().min(1),
  content: z.string(),
  chunkSize: z.number().int().positive().optional().default(500),
  chunkOverlap: z.number().int().nonnegative().optional().default(50),
});

const SearchTextSchema = z.object({
  query: z.string().min(1),
  topK: z.number().int().positive().optional().default(5),
  similarityThreshold: z.number().min(0).max(1).optional().default(0),
});

const AskQuestionSchema = z.object({
  query: z.string().min(1),
});

/**
 * Register RAG IPC handlers
 */
export function registerRAGHandlers() {
  // Initialize RAG service
  ipcMain.handle(IPC_CHANNELS.RAG_INITIALIZE, async (event, request) => {
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

  // Index a single note (Batch-Atomic)
  ipcMain.handle(IPC_CHANNELS.RAG_INDEX_NOTE, async (event, request) => {
    try {
      licenseService.ensureFeatureEnabled(LICENSE_RUNTIME_FEATURES.RAG);
      const validated = IndexNoteSchema.parse(request);
      const result = await ragService.indexNote(validated);
      return result;
    } catch (error) {
      const message = getErrorMessage(error);
      logger.error(`RAG_INDEX_NOTE error: ${message}`);
      return { success: false, error: message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.RAG_SEARCH_TEXT, async (_event, request) => {
    try {
      licenseService.ensureFeatureEnabled(LICENSE_RUNTIME_FEATURES.RAG);
      const validated = SearchTextSchema.parse(request);
      const ragConfig = await aiConfigService.resolveRagConfig();

      if (!ragService.isReady()) {
        await ragService.initialize(ragConfig.workspaceRoot, ragConfig.embeddingConfig);
      } else {
        ragService.updateEmbeddingConfig(ragConfig.embeddingConfig);
      }

      const queryEmbedding = await generateEmbeddingSingle(validated.query, ragConfig.embeddingConfig);
      const results = await ragService.searchByVector({
        queryEmbedding,
        topK: validated.topK,
        similarityThreshold: validated.similarityThreshold,
      });

      return { success: true, results };
    } catch (error) {
      const message = getErrorMessage(error);
      logger.error(`RAG_SEARCH_TEXT error: ${message}`);
      return { success: false, error: message, results: [] };
    }
  });

  // Delete note index (Atomic)
  ipcMain.handle(IPC_CHANNELS.RAG_DELETE_NOTE_INDEX, async (event, noteId) => {
    try {
      licenseService.ensureFeatureEnabled(LICENSE_RUNTIME_FEATURES.RAG);
      z.string().parse(noteId);
      const result = await ragService.deleteNoteIndex(noteId);
      return result;
    } catch (error) {
      const message = getErrorMessage(error);
      logger.error(`RAG_DELETE_NOTE_INDEX error: ${message}`);
      return { success: false, error: message };
    }
  });

  // Get RAG status (Atomic)
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

  ipcMain.handle(IPC_CHANNELS.RAG_ASK_QUESTION, async (_event, request) => {
    try {
      licenseService.ensureFeatureEnabled(LICENSE_RUNTIME_FEATURES.RAG);
      const validated = AskQuestionSchema.parse(request);
      const ragConfig = await aiConfigService.resolveRagConfig();

      if (!ragService.isReady()) {
        await ragService.initialize(ragConfig.workspaceRoot, ragConfig.embeddingConfig);
      } else {
        ragService.updateEmbeddingConfig(ragConfig.embeddingConfig);
      }

      const queryEmbedding = await generateEmbeddingSingle(validated.query, ragConfig.embeddingConfig);
      const results = await ragService.searchByVector({
        queryEmbedding,
        topK: Number(ragConfig.rag.topK),
        similarityThreshold: Number(ragConfig.rag.similarityThreshold),
      });

      if (!results.length) {
        return { success: false, error: 'No relevant context found in notes' };
      }

      if (!ragConfig.chatConfig) {
        const summary = results
          .map((res, idx) => `[${idx + 1}] ${res.noteTitle || 'Untitled'}:\n${res.chunk.content}`)
          .join('\n\n');
        return {
          success: true,
          answer: `${summary}`,
          usedSearchFallback: true,
        };
      }

      const contextText = results.map((res) => res.chunk.content).join('\n---\n');
      const systemPrompt = [
        '你是一个专业的笔记助手。请基于提供的笔记内容进行简洁、专业的回答。',
        '',
        '必须严格遵守下列规则：',
        '1. 只能使用用户提供的笔记内容进行回答。',
        '2. 在正文中直接回答问题，给出结论和要点，不要转述无关背景，不要包含冗余的解释，保证文本简洁明了。',
        '3. 回答时禁止包含笔记中未提及的外部知识。',
        '',
        '笔记内容：',
        contextText,
      ].join('\n');

      const response = await remoteAiService.chat({
        endpoint: ragConfig.chatConfig.endpoint,
        apiKey: ragConfig.chatConfig.apiKey,
        model: ragConfig.chatConfig.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: validated.query },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      return {
        success: true,
        answer: response.choices?.[0]?.message?.content,
        usedSearchFallback: false,
      };
    } catch (error) {
      const message = getErrorMessage(error);
      logger.error(`RAG_ASK_QUESTION error: ${message}`);
      return { success: false, error: message };
    }
  });

  logger.info('RAG IPC handlers registered');
}
