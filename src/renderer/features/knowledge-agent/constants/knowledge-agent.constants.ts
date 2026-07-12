export const DEFAULT_KNOWLEDGE_AGENT_CONFIG = {
  enabled: false,
  embeddingSourceId: '',
  embeddingModel: '',
  chatSourceId: '',
  chatModel: '',
  rerankerSourceId: '',
  chunkSize: 500,
  chunkOverlap: 50,
  topK: 5,
  similarityThreshold: 0.45,
  autoIndex: false,
  indexOnSave: false,
  lastIndexedAt: null,
  indexSignatures: {} as Record<string, string>,
  indexChunkCounts: {} as Record<string, number>,
  cachedTotalChunks: 0,
};

export const KNOWLEDGE_AGENT_CONSTRAINTS = {
  MIN_CHUNK_SIZE: 200,
  MAX_CHUNK_SIZE: 1200,
  MIN_CHUNK_OVERLAP: 0,
  MAX_CHUNK_OVERLAP: 300,
  MIN_TOP_K: 1,
  MAX_TOP_K: 20,
  MIN_SIMILARITY: 0,
  MAX_SIMILARITY: 1,
} as const;

export const KNOWLEDGE_AGENT_EVENTS = {
  INDEX_START: 'knowledge-agent:index:start',
  INDEX_PROGRESS: 'knowledge-agent:index:progress',
  INDEX_COMPLETE: 'knowledge-agent:index:complete',
  INDEX_ERROR: 'knowledge-agent:index:error',
  SEARCH_START: 'knowledge-agent:search:start',
  SEARCH_COMPLETE: 'knowledge-agent:search:complete',
  SEARCH_ERROR: 'knowledge-agent:search:error',
} as const;

export const KNOWLEDGE_AGENT_ERROR_MESSAGES = {
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

export const KNOWLEDGE_AGENT_ERROR_CODES = {
  INDEX_DIMENSION_MISMATCH: 'INDEX_DIMENSION_MISMATCH',
} as const;

export const RECOMMENDED_EMBEDDING_MODELS = {
  OPENAI: {
    small: 'text-embedding-3-small',
    large: 'text-embedding-3-large',
    ada: 'text-embedding-ada-002',
  },
  DEEPSEEK: {
    default: 'text-embedding-v1',
  },
} as const;
