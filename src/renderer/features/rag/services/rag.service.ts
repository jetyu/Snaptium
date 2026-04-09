import { electronApi, type RagSearchResult, type RagStatusResult } from '@renderer/core/bridge/electronApi';
import { aiService } from '@renderer/features/ai/services/ai.service';
import { createLogger } from '@renderer/features/logger';

const ragLogger = createLogger('Renderer:RAG Service');

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
      const config = await electronApi.settings.getConfig() as any;
      if (!config.rag?.enabled) {
        return { success: false, error: 'RAG is disabled in settings' };
      }

      const workspaceRoot = config.noteSavePath as string;
      if (!workspaceRoot) {
        return { success: false, error: 'No workspace root configured' };
      }

      const sourceId = config.rag.embeddingSourceId;
      const source = (config.aiSources as any[]).find(s => s.id === sourceId);

      if (!source) {
        return { success: false, error: 'Embedding source not found' };
      }

      const embeddingConfig = {
        endpoint: source.endpoint,
        apiKey: source.apiKey,
        model: config.rag.embeddingModel,
      };

      const result = await electronApi.rag.initialize({
        workspaceRoot,
        embeddingConfig,
      });

      return result;
    } catch (error: any) {
      ragLogger.error('RAG initialization failed', { error: error.message });
      return { success: false, error: error.message };
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
      const config = await electronApi.settings.getConfig() as any;
      const sourceId = config.rag.embeddingSourceId;
      const source = (config.aiSources as any[]).find((s: any) => s.id === sourceId);

      if (!source) throw new Error('Embedding source not found');

      const embeddingConfig = {
        endpoint: source.endpoint,
        apiKey: source.apiKey,
        model: config.rag.embeddingModel,
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

      return searchRes;
    } catch (error: any) {
      ragLogger.error('RAG search failed', { error: error.message });
      return { success: false, results: [], error: error.message };
    }
  },

  /**
   * Orchestrate query -> search -> AI answer (Business Orchestration)
   */
  async askQuestion(query: string): Promise<{ success: boolean; answer?: string; error?: string }> {
    try {
      const config = await electronApi.settings.getConfig() as any;
      const sourceId = config.rag.embeddingSourceId;
      const source = (config.aiSources as any[]).find((s: any) => s.id === sourceId);

      if (!source) throw new Error('Embedding source not found');

      const embeddingConfig = {
        endpoint: source.endpoint,
        apiKey: source.apiKey,
        model: config.rag.embeddingModel,
      };

      // 1. Generate query embedding (Atomic Main call)
      const queryEmbedding = await electronApi.embedding.generateSingle({
        text: query,
        config: embeddingConfig,
      });

      // 2. Vector Search (Atomic Main call)
      const searchRes = await electronApi.rag.search({
        queryEmbedding,
        topK: 5,
        similarityThreshold: 0.4,
      });

      if (!searchRes.success || !searchRes.results?.length) {
        return { success: false, error: 'No relevant context found in notes' };
      }

      // 3. Coordinate AI via unified service
      const contexts = searchRes.results.map(r => r.chunk.content);
      
      const chatSourceId = config.aiChat?.sourceId || sourceId;
      const chatSource = (config.aiSources as any[]).find((s: any) => s.id === chatSourceId);
      
      if (!chatSource) {
        ragLogger.info('No chat model configured, falling back to search results');
        const summary = searchRes.results
          .map((res, idx) => `[${idx + 1}] ${res.noteTitle || 'Untitled'}:\n${res.chunk.content}`)
          .join('\n\n');
        return { success: true, answer: summary };
      }

      return await aiService.generateRagAnswer({
        query,
        contexts,
        config: {
          endpoint: chatSource.endpoint,
          apiKey: chatSource.apiKey,
          model: config.aiChat?.model || chatSource.model || chatSource.aiModel,
        },
      });
    } catch (error: any) {
      ragLogger.error('RAG question failed', { error: error.message });
      return { success: false, error: error.message };
    }
  },

  async getStatus(): Promise<RagStatusResult> {
    return await electronApi.rag.getStatus();
  },

  async deleteNoteIndex(noteId: string): Promise<{ success: boolean; error?: string }> {
    return await electronApi.rag.deleteNoteIndex(noteId);
  },
};
