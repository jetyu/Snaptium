import { vectorStoreService } from './vector-store.service.js';
import { generateEmbeddingsBatch } from './embedding.service.js';
import { chunkMarkdown } from '../utils/text-chunker.js';
import { loggerService } from './logger.service.js';
import { getErrorMessage } from '../services/error.service.js';

const logger = loggerService.createLogger('Main:RAG Service');

interface EmbeddingConfig {
  endpoint: string;
  apiKey: string;
  model: string;
}

interface IndexNoteParams {
  noteId: string;
  noteTitle: string;
  content: string;
  chunkSize?: number;
  chunkOverlap?: number;
}

interface SearchByVectorParams {
  queryEmbedding: number[];
  topK: number;
  similarityThreshold: number;
}

interface SearchResultItem {
  chunk: {
    id: string;
    noteId: string;
    content: string;
    startPos: number;
    endPos: number;
  };
  score: number;
  noteTitle?: string;
}

/**
 * RAG Service - Execution Layer
 * Provides atomic and batch-atomic capabilities for vector storage and retrieval.
 */
class RAGService {
  private isInitialized: boolean;
  private workspaceRoot: string | null;
  private embeddingConfig: EmbeddingConfig | null;

  constructor() {
    this.isInitialized = false;
    this.workspaceRoot = null;
    this.embeddingConfig = null;
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Initialize RAG service (Atomic)
   * @param {string} workspaceRoot - Workspace root directory
   * @param {Object} embeddingConfig - Embedding API configuration
   */
  async initialize(workspaceRoot: string, embeddingConfig: EmbeddingConfig): Promise<{ success: boolean }> {
    try {
      logger.info(`Initializing with workspace root: ${workspaceRoot}`);

      if (!embeddingConfig?.endpoint || !embeddingConfig?.model) {
        throw new Error('Invalid embedding configuration: Missing endpoint or model');
      }

      this.workspaceRoot = workspaceRoot;
      this.embeddingConfig = embeddingConfig;

      await vectorStoreService.initialize(workspaceRoot);

      this.isInitialized = true;
      logger.info('Initialization complete');
      return { success: true };
    } catch (error) {
      logger.error(`Initialization failed: ${getErrorMessage(error)}`);
      this.isInitialized = false;
      throw error;
    }
  }

  /**
   * Index a single note (Batch-Atomic for performance)
   * Chunks content, generates embeddings, and stores in vector DB in one turn.
   * @param {Object} params - Indexing parameters
   */
  async indexNote(params: IndexNoteParams): Promise<{ success: boolean; chunksIndexed: number }> {
    if (!this.isInitialized) {
      throw new Error('RAG service not initialized');
    }

    const { noteId, noteTitle, content, chunkSize, chunkOverlap } = params;

    try {
      if (!content || content.trim().length === 0) {
        await vectorStoreService.deleteByNoteId(noteId);
        return { success: true, chunksIndexed: 0 };
      }

      // 1. Clear existing chunks for this note
      await vectorStoreService.deleteByNoteId(noteId);

      // 2. Chunking
      let textChunks = chunkMarkdown(content, chunkSize, chunkOverlap);
      textChunks = textChunks.filter(chunk => chunk.content && chunk.content.trim().length > 0);

      if (textChunks.length === 0) {
        return { success: true, chunksIndexed: 0 };
      }

      // 3. Embedding (Batch)
      if (!this.embeddingConfig) {
        throw new Error('Embedding configuration is unavailable');
      }
      const texts = textChunks.map(chunk => chunk.content);
      const embeddings = await generateEmbeddingsBatch(texts, this.embeddingConfig);

      // 4. Store
      const chunks = textChunks.map((chunk, index) => ({
        id: `${noteId}_chunk${index}`,
        noteId,
        noteTitle,
        content: chunk.content,
        startPos: chunk.startPos,
        endPos: chunk.endPos,
        vector: embeddings[index],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));

      await vectorStoreService.addChunks(chunks);

      return {
        success: true,
        chunksIndexed: chunks.length,
      };
    } catch (error) {
      logger.error(`Error indexing note ${noteId}: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Search for relevant chunks by vector (Atomic)
   * @param {Object} params - Search parameters
   */
  async searchByVector(params: SearchByVectorParams): Promise<SearchResultItem[]> {
    if (!this.isInitialized) {
      throw new Error('RAG service not initialized');
    }

    const { queryEmbedding, topK, similarityThreshold } = params;

    try {
      const results = await vectorStoreService.search(
        queryEmbedding,
        topK,
        similarityThreshold
      );

      const mappedResults: SearchResultItem[] = [];
      for (const result of results) {
        const noteId = typeof result.noteId === 'string' ? result.noteId : '';
        const content = typeof result.content === 'string' ? result.content : '';
        if (!noteId || !content) {
          continue;
        }

        const startPos = Number(result.startPos ?? 0);
        const endPos = Number(result.endPos ?? startPos);
        const score = Number(result.score);
        mappedResults.push({
          chunk: {
            id: result.id,
            noteId,
            content,
            startPos: Number.isFinite(startPos) ? startPos : 0,
            endPos: Number.isFinite(endPos) ? endPos : 0,
          },
          score: Number.isFinite(score) ? score : 0,
          noteTitle: typeof result.noteTitle === 'string' ? result.noteTitle : undefined,
        });
      }

      return mappedResults;
    } catch (error) {
      logger.error(`Search error: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Delete index for a note (Atomic)
   * @param {string} noteId - Note ID
   */
  async deleteNoteIndex(noteId: string): Promise<{ success: boolean }> {
    if (!this.isInitialized) {
      throw new Error('RAG service not initialized');
    }

    try {
      await vectorStoreService.deleteByNoteId(noteId);
      return { success: true };
    } catch (error) {
      logger.error(`Error deleting note index ${noteId}: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Get RAG service status (Atomic)
   * @returns {Promise<Object>} Status object
   */
  async getStatus(): Promise<Record<string, unknown>> {
    if (!this.isInitialized) {
      return {
        isInitialized: false,
        message: 'RAG service not initialized',
      };
    }

    try {
      const stats = await vectorStoreService.getStats();
      const { isInitialized: _ignored, ...restStats } = stats;
      return {
        isInitialized: true,
        ...restStats,
      };
    } catch (error) {
      logger.error(`Error getting status: ${getErrorMessage(error)}`);
      return {
        isInitialized: true,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Clear all data from the vector store (Atomic)
   */
  async clear(): Promise<void> {
    if (!this.isInitialized) return;
    await vectorStoreService.clear();
  }

  /**
   * Update embedding configuration (Atomic)
   * @param {Object} embeddingConfig - New embedding configuration
   */
  updateEmbeddingConfig(embeddingConfig: EmbeddingConfig): void {
    this.embeddingConfig = embeddingConfig;
    logger.info('Embedding config updated');
  }

  /**
   * Shutdown RAG service (Atomic)
   */
  async shutdown(): Promise<void> {
    if (this.isInitialized) {
      await vectorStoreService.close();
      this.isInitialized = false;
      logger.info('Shutdown complete');
    }
  }
}

export const ragService = new RAGService();
