import * as lancedb from '@lancedb/lancedb';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { loggerService } from './logger.service.js';

const logger = loggerService.createLogger('Electron:Vector Store Service');

class VectorStoreService {
  constructor() {
    this.db = null;
    this.table = null;
    this.tableName = 'note_chunks';
    this.isInitialized = false;
  }

  /**
   * Initialize LanceDB connection
   * @param {string} workspaceRoot - Workspace root directory
   */
  async initialize(workspaceRoot) {
    try {
      const dbPath = path.join(workspaceRoot, 'Database');

      await fs.mkdir(dbPath, { recursive: true });

      logger.debug(`Initializing LanceDB at: ${dbPath}`);

      this.db = await lancedb.connect(dbPath);

      try {
        this.table = await this.db.openTable(this.tableName);
        logger.debug(`Opened existing table: ${this.tableName}`);
      } catch {
        logger.warn('Table not found, will create on first insert');
        this.table = null;
      }

      this.isInitialized = true;
      logger.debug('Initialization complete');
    } catch (error) {
      logger.error(`Initialization failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Add or update chunks for a note
   * @param {Array<Object>} chunks - Array of chunk objects
   * @returns {Promise<void>}
   */
  async addChunks(chunks) {
    if (!this.isInitialized) {
      throw new Error('Vector store not initialized');
    }

    if (!chunks || chunks.length === 0) {
      return;
    }

    try {
      logger.debug(`Adding ${chunks.length} chunks`);

      if (!this.table) {
        this.table = await this.db.createTable(this.tableName, chunks, { mode: 'overwrite' });
        logger.debug(`Created new table: ${this.tableName}`);
      } else {
        await this.table.add(chunks);
      }

      logger.debug(`Successfully added ${chunks.length} chunks`);
    } catch (error) {
      logger.error(`Error adding chunks: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Search for similar chunks
   * @param {Array<number>} queryEmbedding - Query embedding vector
   * @param {number} topK - Number of results to return
   * @param {number} threshold - Similarity threshold (0-1)
   * @returns {Promise<Array<Object>>} Array of search results
   */
  async search(queryEmbedding, topK = 5, threshold = 0.0) {
    if (!this.isInitialized || !this.table) {
      logger.warn('No table available for search');
      return [];
    }

    try {
      logger.debug(`Searching with topK=${topK}, threshold=${threshold}`);

      const results = await this.table
        .search(queryEmbedding)
        .column('vector')
        .limit(topK * 2)
        .execute();

      logger.debug(
        `Raw results type=${typeof results}, asyncIterator=${!!(results && typeof results[Symbol.asyncIterator] === 'function')}`
      );

      let resultsArray = [];
      if (results && typeof results[Symbol.asyncIterator] === 'function') {
        for await (const batch of results) {
          if (batch && batch.toArray) {
            resultsArray.push(...batch.toArray());
          } else if (batch && typeof batch === 'object') {
            resultsArray.push(batch);
          }
        }
      } else if (Array.isArray(results)) {
        resultsArray = results;
      }

      logger.debug(`Results array length: ${resultsArray.length}`);

      const withScores = resultsArray.map(result => ({
        ...result,
        score: 1 / (1 + (result._distance || 0)),
      }));

      logger.debug(`Computed scores for ${withScores.length} results`);

      const uniqueResults = [];
      const seenIds = new Set();
      for (const result of withScores) {
        if (!seenIds.has(result.id)) {
          seenIds.add(result.id);
          uniqueResults.push(result);
        }
      }

      logger.debug(
        `After deduplication: ${uniqueResults.length} results (removed ${withScores.length - uniqueResults.length} duplicates)`
      );

      const effectiveThreshold = Math.max(0, Math.min(1, threshold));

      const filtered = uniqueResults
        .filter(result => result.score >= effectiveThreshold)
        .slice(0, topK);

      logger.debug(
        `After threshold filter (requested=${threshold}, effective=${effectiveThreshold}): ${filtered.length} results`
      );
      logger.debug(`After topK limit (${topK}): ${filtered.length} results`);

      return filtered;
    } catch (error) {
      logger.error(`Search error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Delete all chunks for a note
   * @param {string} noteId - Note ID
   * @returns {Promise<void>}
   */
  async deleteByNoteId(noteId) {
    if (!this.isInitialized || !this.table) {
      logger.warn('No table available for deletion');
      return;
    }

    try {
      await this.table.delete(`noteId = '${noteId}'`);
      logger.debug(`Deleted chunks for note ${noteId}`);
    } catch (error) {
      logger.error(`Error deleting chunks: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Get statistics about the vector store
   * @returns {Promise<Object>} Statistics object
   */
  async getStats() {
    if (!this.isInitialized || !this.table) {
      return {
        totalChunks: 0,
        isInitialized: false,
      };
    }

    try {
      const count = await this.table.countRows();

      return {
        totalChunks: count,
        isInitialized: true,
        tableName: this.tableName,
      };
    } catch (error) {
      logger.error(`Error getting stats: ${error instanceof Error ? error.message : String(error)}`);
      return {
        totalChunks: 0,
        isInitialized: true,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Clear all data from the vector store
   * @returns {Promise<void>}
   */
  async clear() {
    if (!this.isInitialized || !this.db) {
      return;
    }

    try {
      const tableNames = await this.db.tableNames();
      if (tableNames.includes(this.tableName)) {
        await this.db.dropTable(this.tableName);
      }
      this.table = null;
      logger.debug('Data cleared');
    } catch (error) {
      logger.error(`Error clearing data: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Close the database connection
   */
  async close() {
    if (this.db) {
      this.db = null;
      this.table = null;
      this.isInitialized = false;
      logger.debug('Vector DB Connection closed');
    }
  }
}

export const vectorStoreService = new VectorStoreService();
