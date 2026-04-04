import { electronApi } from '@renderer/core/bridge/electronApi';

export interface IndexNoteRequest {
  noteId: string;
  noteTitle: string;
  notePath: string;
  chunkSize: number;
  chunkOverlap: number;
}

export interface RebuildIndexRequest {
  notes: Array<{
    id: string;
    title: string;
    path: string;
  }>;
  chunkSize: number;
  chunkOverlap: number;
}

export interface InitializeRequest {
  workspaceRoot: string;
  embeddingConfig: {
    endpoint: string;
    apiKey: string;
    model: string;
  };
}

export interface SearchRequest {
  query: string;
  topK: number;
  similarityThreshold: number;
}

export interface SearchResult {
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

export interface IndexStatus {
  isInitialized: boolean;
  totalChunks: number;
  tableName?: string;
  error?: string;
}

export interface GenerateAnswerRequest {
  endpoint: string;
  apiKey: string;
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
}

function isAvailable(): boolean {
  return electronApi.rag.isAvailable();
}

export const ragService = {
  isAvailable,

  async initialize(request: InitializeRequest): Promise<{ success: boolean; error?: string }> {
    return await electronApi.rag.initialize(request);
  },

  async indexNote(request: IndexNoteRequest): Promise<{ success: boolean; chunksIndexed?: number; error?: string }> {
    return await electronApi.rag.indexNote(request);
  },

  async rebuildIndex(request: RebuildIndexRequest): Promise<{
    success: boolean;
    notesIndexed?: number;
    notesFailed?: number;
    totalChunks?: number;
    error?: string;
  }> {
    return await electronApi.rag.rebuildIndex(request);
  },

  async search(request: SearchRequest): Promise<{ success: boolean; results: SearchResult[]; error?: string }> {
    const response = await electronApi.rag.search(request);
    return {
      ...response,
      results: response.results || [],
    };
  },

  async getStatus(): Promise<{ success: boolean } & IndexStatus> {
    return await electronApi.rag.getStatus();
  },

  async deleteNoteIndex(noteId: string): Promise<{ success: boolean; error?: string }> {
    return await electronApi.rag.deleteNoteIndex(noteId);
  },

  async updateConfig(embeddingConfig: { endpoint: string; apiKey: string; model: string }): Promise<{ success: boolean; error?: string }> {
    return await electronApi.rag.updateConfig(embeddingConfig);
  },

  async generateAnswer(request: GenerateAnswerRequest): Promise<{ success: boolean; answer?: string; error?: string }> {
    return await electronApi.aiChat.generate(request);
  },
};
