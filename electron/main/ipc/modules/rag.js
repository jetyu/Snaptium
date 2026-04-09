/**
 * RAG IPC Handlers
 * Handles communication between renderer and main process for RAG operations
 */

import { ipcMain } from 'electron';
import { z } from 'zod';
import { ragService } from '../../services/rag.service.js';
import { IPC_CHANNELS } from '../../constants/ipc.constants.js';
import { loggerService } from '../../services/logger.service.js';

const logger = loggerService.createLogger('Main:RAG IPC');

// Validation Schemas
const InitializeSchema = z.object({
  workspaceRoot: z.string().min(1),
  embeddingConfig: z.object({
    endpoint: z.string().url(),
    apiKey: z.string().min(1),
    model: z.string().min(1),
  }),
});

const IndexNoteSchema = z.object({
  noteId: z.string().min(1),
  noteTitle: z.string().min(1),
  content: z.string(),
  chunkSize: z.number().int().positive().optional().default(500),
  chunkOverlap: z.number().int().nonnegative().optional().default(50),
});

const SearchByVectorSchema = z.object({
  queryEmbedding: z.array(z.number()),
  topK: z.number().int().positive().optional().default(5),
  similarityThreshold: z.number().min(0).max(1).optional().default(0),
});

const UpdateConfigSchema = z.object({
  endpoint: z.string().url(),
  apiKey: z.string().min(1),
  model: z.string().min(1),
});

/**
 * Register RAG IPC handlers
 */
export function registerRAGHandlers() {
  // Initialize RAG service
  ipcMain.handle(IPC_CHANNELS.RAG_INITIALIZE, async (event, request) => {
    try {
      const validated = InitializeSchema.parse(request);
      await ragService.initialize(validated.workspaceRoot, validated.embeddingConfig);
      return { success: true };
    } catch (error) {
      logger.error(`RAG_INITIALIZE error: ${error.message}`);
      return { success: false, error: error.message };
    }
  });

  // Index a single note (Batch-Atomic)
  ipcMain.handle(IPC_CHANNELS.RAG_INDEX_NOTE, async (event, request) => {
    try {
      const validated = IndexNoteSchema.parse(request);
      const result = await ragService.indexNote(validated);
      return { success: true, ...result };
    } catch (error) {
      logger.error(`RAG_INDEX_NOTE error: ${error.message}`);
      return { success: false, error: error.message };
    }
  });

  // Search by vector (Atomic)
  ipcMain.handle(IPC_CHANNELS.RAG_SEARCH, async (event, request) => {
    try {
      const validated = SearchByVectorSchema.parse(request);
      const results = await ragService.searchByVector(validated);
      return { success: true, results };
    } catch (error) {
      logger.error(`RAG_SEARCH error: ${error.message}`);
      return { success: false, error: error.message, results: [] };
    }
  });

  // Delete note index (Atomic)
  ipcMain.handle(IPC_CHANNELS.RAG_DELETE_NOTE_INDEX, async (event, noteId) => {
    try {
      z.string().parse(noteId);
      const result = await ragService.deleteNoteIndex(noteId);
      return { success: true, ...result };
    } catch (error) {
      logger.error(`RAG_DELETE_NOTE_INDEX error: ${error.message}`);
      return { success: false, error: error.message };
    }
  });

  // Get RAG status (Atomic)
  ipcMain.handle(IPC_CHANNELS.RAG_GET_STATUS, async () => {
    try {
      const status = await ragService.getStatus();
      return { success: true, ...status };
    } catch (error) {
      logger.error(`RAG_GET_STATUS error: ${error.message}`);
      return { success: false, error: error.message };
    }
  });

  // Update embedding configuration (Atomic)
  ipcMain.handle(IPC_CHANNELS.RAG_UPDATE_CONFIG, async (event, request) => {
    try {
      const validated = UpdateConfigSchema.parse(request);
      ragService.updateEmbeddingConfig(validated);
      return { success: true };
    } catch (error) {
      logger.error(`RAG_UPDATE_CONFIG error: ${error.message}`);
      return { success: false, error: error.message };
    }
  });

  logger.info('RAG IPC handlers registered');
}
