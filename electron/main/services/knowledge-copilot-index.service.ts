import { vectorStoreService } from './vector-store.service.js';
import { loggerService } from './logger.service.js';
import { getErrorMessage } from '../services/error.service.js';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from '@langchain/core/documents';
import { createProviderEmbeddings, createProviderReranker } from './ai-provider.service.js';
import { SnaptiumLanceVectorStore } from './snaptium-lance-vector-store.js';
import type { AiProvider } from '../../shared/ai-provider.constants.js';

const logger = loggerService.createLogger('Main:KnowledgeCopilotIndexService');

interface EmbeddingConfig {
  provider: AiProvider;
  baseUrl: string;
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

interface RerankerConfig {
  provider: AiProvider;
  baseUrl: string;
  endpoint: string;
  apiKey: string;
  model: string;
}

interface SearchKnowledgeBaseParams {
  query: string;
  topK: number;
  similarityThreshold: number;
  rerankerConfig?: RerankerConfig | null;
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

const RERANK_CANDIDATE_MIN = 12;
const RERANK_CANDIDATE_MULTIPLIER = 3;
const RERANK_CANDIDATE_MAX = 20;

/**
 * Knowledge-agent index service - execution layer.
 * Provides atomic and batch-atomic capabilities for vector storage and retrieval.
 */
class KnowledgeCopilotIndexService {
  private isInitialized: boolean;
  private workspaceRoot: string | null;
  private embeddingConfig: EmbeddingConfig | null;
  private vectorStore: SnaptiumLanceVectorStore | null;

  constructor() {
    this.isInitialized = false;
    this.workspaceRoot = null;
    this.embeddingConfig = null;
    this.vectorStore = null;
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Initialize knowledge-copilot index service (Atomic)
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
      this.vectorStore = new SnaptiumLanceVectorStore(createProviderEmbeddings({
        provider: embeddingConfig.provider,
        baseUrl: embeddingConfig.baseUrl,
        apiKey: embeddingConfig.apiKey,
        model: embeddingConfig.model,
      }));
      await this.vectorStore.initialize(workspaceRoot);

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
      throw new Error('Knowledge agent index service not initialized');
    }

    const { noteId, noteTitle, content, chunkSize, chunkOverlap } = params;

    try {
      if (!content || content.trim().length === 0) {
        await vectorStoreService.deleteByNoteId(noteId);
        return { success: true, chunksIndexed: 0 };
      }

      if (!this.vectorStore) throw new Error('Knowledge Copilot vector store is unavailable');
      await this.vectorStore.delete({ noteId });

      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: chunkSize ?? 500,
        chunkOverlap: chunkOverlap ?? 50,
      });
      const textChunks = (await splitter.splitDocuments([
        new Document({ pageContent: content, metadata: { noteId, noteTitle } }),
      ])).filter((chunk) => chunk.pageContent.trim().length > 0);

      if (textChunks.length === 0) {
        return { success: true, chunksIndexed: 0 };
      }

      const chunks = textChunks.map((chunk, index) => new Document({
        id: `${noteId}_chunk${index}`,
        pageContent: chunk.pageContent,
        metadata: {
          ...chunk.metadata,
          id: `${noteId}_chunk${index}`,
          noteId,
          noteTitle,
          startPos: index * Math.max(1, (chunkSize ?? 500) - (chunkOverlap ?? 50)),
          endPos: index * Math.max(1, (chunkSize ?? 500) - (chunkOverlap ?? 50)) + chunk.pageContent.length,
        },
      }));

      await this.vectorStore.addDocuments(chunks);

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
      throw new Error('Knowledge agent index service not initialized');
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

  async searchKnowledgeBase(params: SearchKnowledgeBaseParams): Promise<SearchResultItem[]> {
    if (!this.isInitialized) {
      throw new Error('Knowledge agent index service not initialized');
    }

    if (!this.embeddingConfig) {
      throw new Error('Embedding configuration is unavailable');
    }

    const { query, topK, similarityThreshold, rerankerConfig } = params;
    const candidateTopK = rerankerConfig
      ? Math.min(Math.max(topK * RERANK_CANDIDATE_MULTIPLIER, RERANK_CANDIDATE_MIN), RERANK_CANDIDATE_MAX)
      : topK;

    if (!this.vectorStore) throw new Error('Knowledge Copilot vector store is unavailable');
    const matches = await this.vectorStore.similaritySearchWithScore(
      query,
      candidateTopK,
      { threshold: similarityThreshold },
    );
    const candidates: SearchResultItem[] = matches.map(([document, score]) => ({
      chunk: {
        id: document.id ?? String(document.metadata.id ?? ''),
        noteId: String(document.metadata.noteId ?? ''),
        content: document.pageContent,
        startPos: Number(document.metadata.startPos ?? 0),
        endPos: Number(document.metadata.endPos ?? document.pageContent.length),
      },
      score,
      noteTitle: typeof document.metadata.noteTitle === 'string' ? document.metadata.noteTitle : undefined,
    }));

    if (!rerankerConfig || candidates.length < 2) {
      return candidates.slice(0, topK);
    }

    try {
      const reranker = createProviderReranker({
        provider: rerankerConfig.provider,
        baseUrl: rerankerConfig.baseUrl,
        apiKey: rerankerConfig.apiKey,
        model: rerankerConfig.model,
      });
      const rerankedDocuments = await reranker.compressDocuments(
        candidates.map((candidate, index) => new Document({
          pageContent: candidate.chunk.content,
          metadata: { candidateIndex: index },
        })),
        query,
      );

      if (!rerankedDocuments.length) {
        return candidates.slice(0, topK);
      }

      const orderedResults: SearchResultItem[] = [];
      const consumedIndexes = new Set<number>();
      for (const document of rerankedDocuments) {
        const candidateIndex = Number(document.metadata.candidateIndex);
        const candidate = candidates[candidateIndex];
        if (!candidate || consumedIndexes.has(candidateIndex)) {
          continue;
        }

        orderedResults.push({
          ...candidate,
          score: Number(document.metadata.relevanceScore ?? candidate.score),
        });
        consumedIndexes.add(candidateIndex);
      }

      for (let index = 0; index < candidates.length; index += 1) {
        if (consumedIndexes.has(index)) {
          continue;
        }

        orderedResults.push(candidates[index]);
      }

      return orderedResults.slice(0, topK);
    } catch (error) {
      logger.warn(`Rerank fallback triggered: ${getErrorMessage(error)}`);
      return candidates.slice(0, topK);
    }
  }

  /**
   * Delete index for a note (Atomic)
   * @param {string} noteId - Note ID
   */
  async deleteNoteIndex(noteId: string): Promise<{ success: boolean }> {
    if (!this.isInitialized) {
      throw new Error('Knowledge agent index service not initialized');
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
   * Get knowledge-copilot index service status (Atomic)
   * @returns {Promise<Object>} Status object
   */
  async getStatus(): Promise<Record<string, unknown>> {
    if (!this.isInitialized) {
      return {
        isInitialized: false,
        message: 'Knowledge agent index service not initialized',
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
  async updateEmbeddingConfig(embeddingConfig: EmbeddingConfig): Promise<void> {
    const changed = !this.embeddingConfig
      || this.embeddingConfig.provider !== embeddingConfig.provider
      || this.embeddingConfig.baseUrl !== embeddingConfig.baseUrl
      || this.embeddingConfig.model !== embeddingConfig.model;
    this.embeddingConfig = embeddingConfig;
    if (!changed || !this.workspaceRoot) return;
    this.vectorStore = new SnaptiumLanceVectorStore(createProviderEmbeddings({
      provider: embeddingConfig.provider,
      baseUrl: embeddingConfig.baseUrl,
      apiKey: embeddingConfig.apiKey,
      model: embeddingConfig.model,
    }));
    await this.vectorStore.initialize(this.workspaceRoot);
    logger.info('Embedding config updated');
  }

  /**
   * Shutdown knowledge-copilot index service (Atomic)
   */
  async shutdown(): Promise<void> {
    if (this.isInitialized) {
      await vectorStoreService.close();
      this.isInitialized = false;
      logger.info('Shutdown complete');
    }
  }
}

export const knowledgeCopilotIndexService = new KnowledgeCopilotIndexService();
