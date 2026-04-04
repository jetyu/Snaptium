/**
 * RAG IPC Handlers
 * Handles communication between renderer and main process for RAG operations
 */

import { ipcMain } from 'electron';
import { ragService } from '../../services/rag.service.js';
import { IPC_CHANNELS } from '../../constants/ipc.constants.js';
import { loggerService } from '../../services/logger.service.js';

const logger = loggerService.createLogger('Electron:RAG IPC');
/**
 * Register RAG IPC handlers
 */
export function registerRAGHandlers() {
  // Initialize RAG service
  ipcMain.handle(IPC_CHANNELS.RAG_INITIALIZE, async (event, { workspaceRoot, embeddingConfig }) => {
    try {
      await ragService.initialize(workspaceRoot, embeddingConfig);
      return { success: true };
    } catch (error) {
      logger.error(`RAG_INITIALIZE error: ${error instanceof Error ? error.message : String(error)}`);
      return { success: false, error: error.message };
    }
  });

  // Index a single note
  ipcMain.handle(IPC_CHANNELS.RAG_INDEX_NOTE, async (event, request) => {
    try {
      const result = await ragService.indexNote(request);
      return { success: true, ...result };
    } catch (error) {
      logger.error(`RAG_INDEX_NOTE error: ${error instanceof Error ? error.message : String(error)}`);
      return { success: false, error: error.message };
    }
  });

  // Rebuild entire index
  ipcMain.handle(IPC_CHANNELS.RAG_REBUILD_INDEX, async (event, request) => {
    try {
      const result = await ragService.rebuildIndex(request);
      return { success: true, ...result };
    } catch (error) {
      logger.error(`RAG_REBUILD_INDEX error: ${error instanceof Error ? error.message : String(error)}`);
      return { success: false, error: error.message };
    }
  });

  // Search for relevant chunks
  ipcMain.handle(IPC_CHANNELS.RAG_SEARCH, async (event, request) => {
    try {
      const results = await ragService.search(request);
      return { success: true, results };
    } catch (error) {
      logger.error(`RAG_SEARCH error: ${error instanceof Error ? error.message : String(error)}`);
      return { success: false, error: error.message, results: [] };
    }
  });

  // Delete note index
  ipcMain.handle(IPC_CHANNELS.RAG_DELETE_NOTE_INDEX, async (event, noteId) => {
    try {
      const result = await ragService.deleteNoteIndex(noteId);
      return { success: true, ...result };
    } catch (error) {
      logger.error(`RAG_DELETE_NOTE_INDEX error: ${error instanceof Error ? error.message : String(error)}`);
      return { success: false, error: error.message };
    }
  });

  // Get RAG status
  ipcMain.handle(IPC_CHANNELS.RAG_GET_STATUS, async () => {
    try {
      const status = await ragService.getStatus();
      return { success: true, ...status };
    } catch (error) {
      logger.error(`RAG_GET_STATUS error: ${error instanceof Error ? error.message : String(error)}`);
      return { success: false, error: error.message };
    }
  });

  // Update embedding configuration
  ipcMain.handle(IPC_CHANNELS.RAG_UPDATE_CONFIG, async (event, embeddingConfig) => {
    try {
      ragService.updateEmbeddingConfig(embeddingConfig);
      return { success: true };
    } catch (error) {
      logger.error(`RAG_UPDATE_CONFIG error: ${error instanceof Error ? error.message : String(error)}`);
      return { success: false, error: error.message };
    }
  });

  logger.info('RAG IPC handlers registered');
}
