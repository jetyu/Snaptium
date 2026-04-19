import { electronApi, type RagSearchResult, type RagStatusResult } from '@renderer/core/bridge/electronApi';
import { createLogger } from '@renderer/features/logger';
import { RAG_ERROR_MESSAGES, RAG_ERROR_CODES } from '../constants/rag.constants';

const ragLogger = createLogger('Renderer:RAG Service');

interface RagConfig {
  enabled?: boolean;
  embeddingSourceId?: string;
}

interface AppConfig {
  rag?: RagConfig;
  noteSavePath?: string;
}

export interface IndexNoteRequest {
  noteId: string;
  noteTitle: string;
  content: string;
  chunkSize?: number;
  chunkOverlap?: number;
}

export interface RebuildIndexProgress {
  total: number;
  current: number;
  success: number;
  failed: number;
}

/**
 * RAG Service - Orchestration Layer
 * Handles complex business logic, initialization, and cross-service coordination.
 */
export const ragService = {
  isAvailable(): boolean {
    return electronApi.rag.isAvailable();
  },

  /**
   * Orchestrate initialization using app settings (Business Logic)
   */
  async initialize(): Promise<{ success: boolean; error?: string }> {
    try {
      const config = await electronApi.settings.getConfig() as unknown as AppConfig;
      if (!config.rag?.enabled) {
        return { success: false, error: RAG_ERROR_MESSAGES.DISABLED };
      }

      const workspaceRoot = config.noteSavePath;
      if (!workspaceRoot) {
        return { success: false, error: RAG_ERROR_MESSAGES.NO_WORKSPACE };
      }

      const result = await electronApi.rag.initialize();

      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      ragLogger.error('RAG initialization failed', { error: message });
      return { success: false, error: message };
    }
  },

  /**
   * Index a single note (Batch-Atomic call to Main)
   */
  async indexNote(request: IndexNoteRequest): Promise<{ success: boolean; chunksIndexed?: number; error?: string }> {
    return await electronApi.rag.indexNote({
      ...request,
      chunkSize: request.chunkSize || 500,
      chunkOverlap: request.chunkOverlap || 50,
    });
  },

  /**
   * Full rebuild loop orchestrated in Renderer (Business Loop)
   */
  async rebuildIndex(
    notes: Array<{ id: string; title: string; content: string }>,
    options: { chunkSize: number; chunkOverlap: number; onProgress?: (p: RebuildIndexProgress) => void }
  ) {
    const clearResult = await electronApi.rag.clearIndex();
    if (!clearResult.success) {
      throw new Error(clearResult.error || 'Failed to clear vector index');
    }

    const total = notes.length;
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < total; i++) {
      const note = notes[i];
      try {
        const res = await this.indexNote({
          noteId: note.id,
          noteTitle: note.title,
          content: note.content,
          chunkSize: options.chunkSize,
          chunkOverlap: options.chunkOverlap,
        });

        if (res.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        failCount++;
      }

      options.onProgress?.({
        total,
        current: i + 1,
        success: successCount,
        failed: failCount,
      });
    }

    return { total, successCount, failCount };
  },

  /**
   * Orchestrate semantic search (Orchestration)
   */
  async search(params: { query: string; topK: number; similarityThreshold: number }): Promise<{ success: boolean; results: RagSearchResult[]; error?: string }> {
    try {
      const searchRes = await electronApi.rag.searchText({
        query: params.query,
        topK: params.topK,
        similarityThreshold: params.similarityThreshold,
      });

      if (!searchRes.success) {
        const errorMessage = searchRes.error || 'Search failed';
        const isDimensionMismatch =
          errorMessage.includes('No vector column found') &&
          errorMessage.toLowerCase().includes('dimension');

        return {
          success: false,
          results: [],
          error: isDimensionMismatch ? RAG_ERROR_CODES.INDEX_DIMENSION_MISMATCH : errorMessage,
        };
      }

      return searchRes;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      ragLogger.error('RAG search failed', { error: errorMessage });
      const isDimensionMismatch =
        errorMessage.includes('No vector column found') &&
        errorMessage.toLowerCase().includes('dimension');

      return {
        success: false,
        results: [],
        error: isDimensionMismatch ? RAG_ERROR_CODES.INDEX_DIMENSION_MISMATCH : errorMessage,
      };
    }
  },

  /**
   * Orchestrate query -> search -> AI answer (Business Orchestration)
   */
  async askQuestion(query: string): Promise<{ success: boolean; answer?: string; error?: string; usedSearchFallback?: boolean }> {
    try {
      return await electronApi.rag.askQuestion({ query });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      ragLogger.error('RAG question failed', { error: message });
      return { success: false, error: message };
    }
  },

  async getStatus(): Promise<RagStatusResult> {
    return await electronApi.rag.getStatus();
  },

  async deleteNoteIndex(noteId: string): Promise<{ success: boolean; error?: string }> {
    return await electronApi.rag.deleteNoteIndex(noteId);
  },

  /**
   * Clear all index data from the vector store
   */
  async clearIndex(): Promise<{ success: boolean; error?: string }> {
    return await electronApi.rag.clearIndex();
  },
};
