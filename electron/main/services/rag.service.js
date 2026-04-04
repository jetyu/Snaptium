import { vectorStoreService } from './vector-store.service.js';
import { generateEmbeddingSingle, generateEmbeddingsBatch } from './embedding.service.js';
import { chunkMarkdown } from '../utils/text-chunker.js';
import { readUtf8 } from './file.service.js';
import { settingsService } from './settings.service.js';
import { loggerService } from './logger.service.js';
import path from 'node:path';
import { promises as fs } from 'node:fs';

const logger = loggerService.createLogger('RAG Service');

class RAGService {
  constructor() {
    this.isInitialized = false;
    this.workspaceRoot = null;
    this.embeddingConfig = null;
  }

  /**
   * Ensure the service is initialized, loading config if necessary
   */
  async ensureInitialized() {
    if (this.isInitialized) return true;

    logger.info('Not initialized. Attempting auto-initialization.');

    try {
      const config = await settingsService.loadConfig();
      if (!config.rag?.enabled) {
        logger.warn('RAG is disabled in settings');
        return false;
      }

      const workspaceRoot = config.noteSavePath;
      if (!workspaceRoot) {
        logger.warn('No workspace root configured');
        return false;
      }

      const sourceId = config.rag.embeddingSourceId;
      const source = config.aiSources.find(s => s.id === sourceId);

      if (!source) {
        logger.warn('Embedding source not found');
        return false;
      }

      const embeddingConfig = {
        endpoint: source.endpoint,
        apiKey: source.apiKey,
        model: config.rag.embeddingModel || source.defaultModel,
      };

      await this.initialize(workspaceRoot, embeddingConfig);
      return this.isInitialized;
    } catch (error) {
      logger.error(`Auto-initialization failed: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Initialize RAG service
   * @param {string} workspaceRoot - Workspace root directory
   * @param {Object} embeddingConfig - Embedding API configuration
   */
  async initialize(workspaceRoot, embeddingConfig) {
    try {
      logger.info(`Initializing with workspace root: ${workspaceRoot}`);
      logger.debug(
        `Embedding config prepared (endpoint=${embeddingConfig?.endpoint}, model=${embeddingConfig?.model}, hasApiKey=${!!embeddingConfig?.apiKey})`
      );

      if (!embeddingConfig?.endpoint || !embeddingConfig?.model) {
        throw new Error('Invalid embedding configuration: Missing endpoint or model');
      }

      this.workspaceRoot = workspaceRoot;
      this.embeddingConfig = embeddingConfig;

      await vectorStoreService.initialize(workspaceRoot);

      this.isInitialized = true;
      logger.info('Initialization complete');
    } catch (error) {
      logger.error(`Initialization failed: ${error instanceof Error ? error.message : String(error)}`);
      this.isInitialized = false;
      throw error;
    }
  }

  /**
   * Index a single note
   * @param {Object} request - Index request
   */
  async indexNote(request) {
    if (!(await this.ensureInitialized())) {
      throw new Error('RAG service not initialized and failed to auto-initialize. Please check your AI settings.');
    }

    const { noteId, noteTitle, notePath, chunkSize, chunkOverlap } = request;

    try {
      logger.info(`Indexing note ${noteId} (${noteTitle})`);
      logger.debug(`Index note path: ${notePath}`);

      const fullPath = path.join(this.workspaceRoot, notePath);
      logger.debug(`Resolved full path: ${fullPath}`);

      try {
        await fs.access(fullPath);
      } catch {
        logger.error(`File not found: ${fullPath}`);
        throw new Error(`File not found: ${notePath}`);
      }

      const content = await readUtf8(fullPath);
      logger.debug(`Content length: ${content?.length || 0} characters`);

      if (!content || content.trim().length === 0) {
        logger.info(`Skipping empty note ${noteId}`);
        return { success: true, chunksIndexed: 0 };
      }

      await vectorStoreService.deleteByNoteId(noteId);

      let textChunks = chunkMarkdown(content, chunkSize, chunkOverlap);
      textChunks = textChunks.filter(chunk => chunk.content && chunk.content.trim().length > 0);
      logger.debug(`Generated ${textChunks.length} non-empty chunks for ${noteId}`);

      if (textChunks.length === 0) {
        logger.info(`No chunks generated for ${noteId}, skipping`);
        return { success: true, chunksIndexed: 0 };
      }

      const texts = textChunks.map(chunk => chunk.content);
      logger.debug(`Generating embeddings for ${texts.length} chunks`);

      const embeddings = await generateEmbeddingsBatch(texts, this.embeddingConfig);
      logger.debug(`Generated ${embeddings.length} embeddings`);

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

      if (chunks.length > 0) {
        logger.debug(
          `First chunk summary: id=${chunks[0].id}, contentLength=${chunks[0].content.length}, hasVector=${!!chunks[0].vector}`
        );
      }

      logger.debug(`Storing ${chunks.length} chunks in vector database`);
      await vectorStoreService.addChunks(chunks);

      logger.info(`Successfully indexed ${chunks.length} chunks for note ${noteId}`);

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
   * Rebuild index for all notes
   * @param {Object} request - Rebuild request
   */
  async rebuildIndex(request) {
    if (!(await this.ensureInitialized())) {
      throw new Error('RAG service not initialized and failed to auto-initialize. Please check your AI settings.');
    }

    const { notes, chunkSize, chunkOverlap } = request;

    try {
      logger.info(`Rebuilding index for ${notes.length} notes`);
      logger.debug(`Rebuild parameters: chunkSize=${chunkSize}, chunkOverlap=${chunkOverlap}`);

      await vectorStoreService.clear();

      let successCount = 0;
      let failCount = 0;
      let totalChunks = 0;
      const errors = [];

      for (const note of notes) {
        try {
          logger.debug(`Processing note ${successCount + failCount + 1}/${notes.length}: ${note.title}`);

          const result = await this.indexNote({
            noteId: note.id,
            noteTitle: note.title,
            notePath: note.path,
            chunkSize,
            chunkOverlap,
          });

          if (result.success) {
            successCount++;
            totalChunks += result.chunksIndexed;
            logger.debug(`Indexed ${result.chunksIndexed} chunks for note ${note.id}`);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logger.error(`Failed to index note ${note.id}: ${message}`);
          failCount++;
          errors.push({ noteId: note.id, noteTitle: note.title, error: message });
        }
      }

      logger.info(`Rebuild complete: success=${successCount}, failed=${failCount}, totalChunks=${totalChunks}`);
      if (errors.length > 0) {
        errors.forEach(err => {
          logger.error(`Rebuild error for ${err.noteTitle}: ${err.error}`);
        });
      }

      return {
        success: true,
        notesIndexed: successCount,
        notesFailed: failCount,
        totalChunks,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      logger.error(`Error rebuilding index: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Search for relevant chunks
   * @param {Object} request - Search request
   */
  async search(request) {
    if (!(await this.ensureInitialized())) {
      throw new Error('RAG service not initialized and failed to auto-initialize. Please check your AI settings.');
    }

    const { query, topK, similarityThreshold } = request;

    try {
      logger.debug(`Searching with topK=${topK}, threshold=${similarityThreshold}`);

      const queryEmbedding = await generateEmbeddingSingle(query, this.embeddingConfig);

      const results = await vectorStoreService.search(
        queryEmbedding,
        topK,
        similarityThreshold
      );

      logger.debug(`Raw search results: ${results.length}`);

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
   * Delete index for a note
   * @param {string} noteId - Note ID
   */
  async deleteNoteIndex(noteId) {
    if (!(await this.ensureInitialized())) {
      throw new Error('RAG service not initialized and failed to auto-initialize. Please check your AI settings.');
    }

    try {
      logger.info(`Deleting index for note ${noteId}`);
      await vectorStoreService.deleteByNoteId(noteId);
      return { success: true };
    } catch (error) {
      logger.error(`Error deleting note index ${noteId}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Get RAG service status
   * @returns {Promise<Object>} Status object
   */
  async getStatus() {
    if (!this.isInitialized) {
      const initialized = await this.ensureInitialized();
      if (!initialized) {
        return {
          isInitialized: false,
          message: 'RAG service not initialized (RAG may be disabled in settings)',
        };
      }
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
   * Update embedding configuration
   * @param {Object} embeddingConfig - New embedding configuration
   */
  updateEmbeddingConfig(embeddingConfig) {
    this.embeddingConfig = embeddingConfig;
    logger.info('Embedding config updated');
  }

  /**
   * Shutdown RAG service
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
