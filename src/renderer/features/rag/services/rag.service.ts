import { electronApi, type RagSearchResult, type RagStatusResult } from '@renderer/core/bridge/electronApi';
import { aiService } from '@renderer/features/ai/services/ai.service';
import { createLogger } from '@renderer/features/logger';
import { DEFAULT_RAG_CONFIG, RAG_ERROR_MESSAGES, RAG_ERROR_CODES, RAG_CHAT_PROMPTS } from '../constants/rag.constants';

const ragLogger = createLogger('Renderer:RAG Service');

interface AiSource {
  id: string;
  endpoint: string;
  apiKey: string;
  aiModel: string;
}

interface RagConfig {
  enabled?: boolean;
  embeddingSourceId?: string;
  embeddingModel?: string;
  ragChatSourceId?: string;
  ragChatModel?: string;
}

interface AppConfig {
  rag?: RagConfig;
  noteSavePath?: string;
  aiSources?: AiSource[];
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

      const sourceId = config.rag.embeddingSourceId;
      const source = config.aiSources?.find(s => s.id === sourceId);

      if (!source) {
        return { success: false, error: RAG_ERROR_MESSAGES.SOURCE_NOT_FOUND };
      }

      const embeddingConfig = {
        endpoint: source.endpoint,
        apiKey: source.apiKey,
        model: config.rag.embeddingModel ?? '',
      };

      const result = await electronApi.rag.initialize({
        workspaceRoot,
        embeddingConfig,
      });

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
      const { query, topK, similarityThreshold } = params;
      const config = await electronApi.settings.getConfig() as unknown as AppConfig;
      const sourceId = config.rag?.embeddingSourceId;
      const source = config.aiSources?.find(s => s.id === sourceId);

      if (!source) throw new Error(RAG_ERROR_MESSAGES.SOURCE_NOT_FOUND);

      const embeddingConfig = {
        endpoint: source.endpoint,
        apiKey: source.apiKey,
        model: config.rag?.embeddingModel ?? '',
      };

      // 1. Generate query embedding (Atomic Main call)
      const queryEmbedding = await electronApi.embedding.generateSingle({
        text: query,
        config: embeddingConfig,
      });

      // 2. Vector Search (Atomic Main call)
      const searchRes = await electronApi.rag.search({
        queryEmbedding,
        topK,
        similarityThreshold,
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
  async askQuestion(query: string): Promise<{ success: boolean; answer?: string; error?: string }> {
    try {
      const config = await electronApi.settings.getConfig() as unknown as AppConfig;
      const sourceId = config.rag?.embeddingSourceId;
      const source = config.aiSources?.find(s => s.id === sourceId);

      if (!source) throw new Error(RAG_ERROR_MESSAGES.SOURCE_NOT_FOUND);

      const embeddingConfig = {
        endpoint: source.endpoint,
        apiKey: source.apiKey,
        model: config.rag?.embeddingModel ?? '',
      };

      // 1. Generate query embedding (Atomic Main call)
      const queryEmbedding = await electronApi.embedding.generateSingle({
        text: query,
        config: embeddingConfig,
      });

      // 2. Vector Search (Atomic Main call)
      const searchRes = await electronApi.rag.search({
        queryEmbedding,
        topK: DEFAULT_RAG_CONFIG.topK,
        similarityThreshold: DEFAULT_RAG_CONFIG.similarityThreshold,
      });

      if (!searchRes.success || !searchRes.results?.length) {
        return { success: false, error: RAG_ERROR_MESSAGES.NO_CONTEXT };
      }

      // 3. Coordinate AI via unified service
      const contexts = searchRes.results.map(r => r.chunk.content);

      const chatSourceId = config.rag?.ragChatSourceId;
      const chatSource = chatSourceId
        ? config.aiSources?.find(s => s.id === chatSourceId)
        : null;

      if (!chatSource) {
        ragLogger.info('No chat model configured, falling back to search results');
        const summary = searchRes.results
          .map((res, idx) => `[${idx + 1}] ${res.noteTitle || 'Untitled'}:\n${res.chunk.content}`)
          .join('\n\n');
        return { success: true, answer: summary };
      }

      const systemPrompt = RAG_CHAT_PROMPTS.SYSTEM.replace('{context}', contexts.join('\n---\n'));

      return await aiService.generateRagAnswer({
        query,
        systemPrompt,
        config: {
          endpoint: chatSource.endpoint,
          apiKey: chatSource.apiKey,
          model: config.rag?.ragChatModel || chatSource.aiModel,
        },
      });
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
};
