import { vectorStoreService } from './vector-store.service.js';
import { generateEmbeddingsBatch } from './embedding.service.js';
import { chunkMarkdown } from '../utils/text-chunker.js';
import { loggerService } from './logger.service.js';

const logger = loggerService.createLogger('Main:RAG Service');

/**
 * RAG Service - Execution Layer
 * Provides atomic and batch-atomic capabilities for vector storage and retrieval.
 */
class RAGService {
  constructor() {
    this.isInitialized = false;
    this.workspaceRoot = null;
    this.embeddingConfig = null;
  }

  isReady() {
    return this.isInitialized;
  }

  /**
   * Initialize RAG service (Atomic)
   * @param {string} workspaceRoot - Workspace root directory
   * @param {Object} embeddingConfig - Embedding API configuration
   */
  async initialize(workspaceRoot, embeddingConfig) {
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
      logger.error(`Initialization failed: ${error instanceof Error ? error.message : String(error)}`);
      this.isInitialized = false;
      throw error;
    }
  }

  /**
   * Index a single note (Batch-Atomic for performance)
   * Chunks content, generates embeddings, and stores in vector DB in one turn.
   * @param {Object} params - Indexing parameters
   */
  async indexNote(params) {
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
      logger.error(`Error indexing note ${noteId}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Search for relevant chunks by vector (Atomic)
   * @param {Object} params - Search parameters
   */
  async searchByVector(params) {
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

      return results.map((result) => ({
        chunk: {
          id: result.id,
          noteId: result.noteId,
          content: result.content,
          startPos: result.startPos,
          endPos: result.endPos,
        },
        score: result.score,
        noteTitle: result.noteTitle,
      }));
    } catch (error) {
      logger.error(`Search error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Delete index for a note (Atomic)
   * @param {string} noteId - Note ID
   */
  async deleteNoteIndex(noteId) {
    if (!this.isInitialized) {
      throw new Error('RAG service not initialized');
    }

    try {
      await vectorStoreService.deleteByNoteId(noteId);
      return { success: true };
    } catch (error) {
      logger.error(`Error deleting note index ${noteId}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Get RAG service status (Atomic)
   * @returns {Promise<Object>} Status object
   */
  async getStatus() {
    if (!this.isInitialized) {
      return {
        isInitialized: false,
        message: 'RAG service not initialized',
      };
    }

    try {
      const stats = await vectorStoreService.getStats();
      return {
        isInitialized: true,
        ...stats,
      };
    } catch (error) {
      logger.error(`Error getting status: ${error instanceof Error ? error.message : String(error)}`);
      return {
        isInitialized: true,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Clear all data from the vector store (Atomic)
   */
  async clear() {
    if (!this.isInitialized) return;
    await vectorStoreService.clear();
  }

  /**
   * Update embedding configuration (Atomic)
   * @param {Object} embeddingConfig - New embedding configuration
   */
  updateEmbeddingConfig(embeddingConfig) {
    this.embeddingConfig = embeddingConfig;
    logger.info('Embedding config updated');
  }

  /**
   * Shutdown RAG service (Atomic)
   */
  async shutdown() {
    if (this.isInitialized) {
      await vectorStoreService.close();
      this.isInitialized = false;
      logger.info('Shutdown complete');
    }
  }
}

export const ragService = new RAGService();
