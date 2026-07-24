export const DEFAULT_KNOWLEDGE_COPILOT_CONFIG = {
  enabled: false,
  embeddingSourceId: '',
  embeddingModel: '',
  askChatSourceId: '',
  askChatModel: '',
  agentChatSourceId: '',
  agentChatModel: '',
  rerankerSourceId: '',
  rerankerModel: '',
  defaultMode: 'ask' as const,
  agentExecutionMode: 'confirm' as const,
  chunkSize: 500,
  chunkOverlap: 50,
  topK: 5,
  similarityThreshold: 0.45,
  autoIndex: true,
  indexOnSave: true,
  lastIndexedAt: null,
  indexSignatures: {} as Record<string, string>,
  indexChunkCounts: {} as Record<string, number>,
  cachedTotalChunks: 0,
};

export const KNOWLEDGE_COPILOT_CONSTRAINTS = {
  MIN_CHUNK_SIZE: 200,
  MAX_CHUNK_SIZE: 1200,
  MIN_CHUNK_OVERLAP: 0,
  MAX_CHUNK_OVERLAP: 300,
  MIN_TOP_K: 1,
  MAX_TOP_K: 20,
  MIN_SIMILARITY: 0,
  MAX_SIMILARITY: 1,
} as const;

export const KNOWLEDGE_COPILOT_EVENTS = {
  INDEX_START: 'knowledge-copilot:index:start',
  INDEX_PROGRESS: 'knowledge-copilot:index:progress',
  INDEX_COMPLETE: 'knowledge-copilot:index:complete',
  INDEX_ERROR: 'knowledge-copilot:index:error',
  SEARCH_START: 'knowledge-copilot:search:start',
  SEARCH_COMPLETE: 'knowledge-copilot:search:complete',
  SEARCH_ERROR: 'knowledge-copilot:search:error',
} as const;

export const KNOWLEDGE_COPILOT_ERROR_MESSAGES = {
  CONFIG_INVALID: 'Knowledge agent configuration is invalid',
  CONFIG_MISSING: 'Knowledge agent configuration is missing',
  DISABLED: 'Knowledge agent is disabled in settings',
  NO_WORKSPACE: 'No workspace root configured',
  SOURCE_NOT_FOUND: 'Embedding source not found',
  MODEL_NOT_SPECIFIED: 'Embedding model not specified',
  EMBEDDING_FAILED: 'Failed to generate embedding',
  INDEX_FAILED: 'Failed to index note',
  SEARCH_FAILED: 'Failed to search',
  STORAGE_FAILED: 'Failed to access storage',
  NOT_INITIALIZED: 'Knowledge agent service not initialized',
  NO_CONTEXT: 'No relevant context found in notes',
} as const;

export const KNOWLEDGE_COPILOT_ERROR_CODES = {
  INDEX_DIMENSION_MISMATCH: 'INDEX_DIMENSION_MISMATCH',
} as const;
