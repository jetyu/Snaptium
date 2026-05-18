import * as lancedb from '@lancedb/lancedb';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { loggerService } from './logger.service.js';
import { getErrorMessage } from '../services/error.service.js';

const logger = loggerService.createLogger('Electron:Vector Store Service');

type LanceDbConnection = Awaited<ReturnType<typeof lancedb.connect>>;
type LanceDbTable = Awaited<ReturnType<LanceDbConnection['openTable']>>;

interface VectorChunk {
  id: string;
  noteId: string;
  vector: number[];
  [key: string]: unknown;
}

interface SearchChunkResult extends Record<string, unknown> {
  id: string;
  score: number;
}

interface VectorStoreStats {
  totalChunks: number;
  isInitialized: boolean;
  tableName?: string;
  error?: string;
}

interface LanceSearchRow extends Record<string, unknown> {
  id?: string;
  _distance?: number;
}

interface ExecutableQuery {
  limit(value: number): ExecutableQuery;
  execute(): Promise<unknown>;
}

function hasAsyncIterator(value: unknown): value is AsyncIterable<unknown> {
  return typeof value === 'object' && value !== null && Symbol.asyncIterator in value;
}

function hasToArray(value: unknown): value is { toArray(): unknown[] } {
  return typeof value === 'object' && value !== null && 'toArray' in value && typeof value.toArray === 'function';
}

class VectorStoreService {
  private db: LanceDbConnection | null;
  private table: LanceDbTable | null;
  private tableName: string;
  private isInitialized: boolean;

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
  async initialize(workspaceRoot: string): Promise<void> {
    try {
      const dbPath = path.join(workspaceRoot, '.lancedb');

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
      logger.error(`Initialization failed: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Add or update chunks for a note
   * @param {Array<Object>} chunks - Array of chunk objects
   * @returns {Promise<void>}
   */
  async addChunks(chunks: VectorChunk[]): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Vector store not initialized');
    }

    if (!chunks || chunks.length === 0) {
      return;
    }

    try {
      logger.debug(`Adding ${chunks.length} chunks`);

      if (!this.db) {
        throw new Error('Vector store database is not available');
      }

      if (!this.table) {
        this.table = await this.db.createTable(this.tableName, chunks, { mode: 'overwrite' });
        logger.debug(`Created new table: ${this.tableName}`);
      } else {
        await this.table.add(chunks);
      }

      logger.debug(`Successfully added ${chunks.length} chunks`);
    } catch (error) {
      logger.error(`Error adding chunks: ${getErrorMessage(error)}`);
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
  async search(queryEmbedding: number[], topK = 5, threshold = 0.0): Promise<SearchChunkResult[]> {
    if (!this.isInitialized || !this.table) {
      logger.warn('No table available for search');
      return [];
    }

    try {
      logger.debug(`Searching with topK=${topK}, threshold=${threshold}`);

      // LanceDB's shipped type definitions lag behind runtime API here.
      const query = this.table.search(queryEmbedding) as unknown as ExecutableQuery;
      const results = await query.limit(topK * 2).execute();

      logger.debug(
        `Raw results type=${typeof results}, asyncIterator=${hasAsyncIterator(results)}`
      );

      let resultsArray: LanceSearchRow[] = [];
      if (hasAsyncIterator(results)) {
        for await (const batch of results) {
          if (hasToArray(batch)) {
            resultsArray.push(...(batch.toArray() as LanceSearchRow[]));
          } else if (batch && typeof batch === 'object') {
            resultsArray.push(batch as unknown as LanceSearchRow);
          }
        }
      } else if (Array.isArray(results)) {
        resultsArray = results as LanceSearchRow[];
      }

      logger.debug(`Results array length: ${resultsArray.length}`);

      const withScores: SearchChunkResult[] = resultsArray.map((result) => ({
        ...result,
        id: String(result.id ?? ''),
        score: 1 / (1 + Number(result._distance ?? 0)),
      }));

      logger.debug(`Computed scores for ${withScores.length} results`);

      const uniqueResults: SearchChunkResult[] = [];
      const seenIds = new Set<string>();
      for (const result of withScores) {
        if (!result.id || seenIds.has(result.id)) {
          continue;
        }
        seenIds.add(result.id);
        uniqueResults.push(result);
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
      logger.error(`Search error: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Delete all chunks for a note
   * @param {string} noteId - Note ID
   * @returns {Promise<void>}
   */
  async deleteByNoteId(noteId: string): Promise<void> {
    if (!this.isInitialized || !this.table) {
      logger.warn('No table available for deletion');
      return;
    }

    try {
      await this.table.delete(`noteId = '${noteId}'`);
      logger.debug(`Deleted chunks for note ${noteId}`);
    } catch (error) {
      logger.error(`Error deleting chunks: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Get statistics about the vector store
   * @returns {Promise<Object>} Statistics object
   */
  async getStats(): Promise<VectorStoreStats> {
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
      logger.error(`Error getting stats: ${getErrorMessage(error)}`);
      return {
        totalChunks: 0,
        isInitialized: true,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Clear all data from the vector store
   * @returns {Promise<void>}
   */
  async clear(): Promise<void> {
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
      logger.error(`Error clearing data: ${getErrorMessage(error)}`);
      throw error;
    }
  }

   /**
    * Close the database connection
    */
  async close(): Promise<void> {
    if (this.db) {
      this.db = null;
      this.table = null;
      this.isInitialized = false;
      logger.debug('Vector DB Connection closed');
    }
  }
}

export const vectorStoreService = new VectorStoreService();
