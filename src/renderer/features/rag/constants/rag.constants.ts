/**
 * RAG Feature Constants
 * 
 * RAG 功能的常量定义
 */

/**
 * 默认 RAG 配置
 */
export const DEFAULT_RAG_CONFIG = {
  enabled: false,
  embeddingSourceId: '',
  embeddingModel: '',
  ragChatSourceId: '',
  ragChatModel: '',
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


/**
 * RAG 配置约束
 */
export const RAG_CONSTRAINTS = {
  /** 最小分块大小 */
  MIN_CHUNK_SIZE: 200,
  /** 最大分块大小 */
  MAX_CHUNK_SIZE: 1200,
  /** 最小重叠大小 */
  MIN_CHUNK_OVERLAP: 0,
  /** 最大重叠大小 */
  MAX_CHUNK_OVERLAP: 300,
  /** 最小 TopK */
  MIN_TOP_K: 1,
  /** 最大 TopK */
  MAX_TOP_K: 20,
  /** 最小相似度阈值 */
  MIN_SIMILARITY: 0,
  /** 最大相似度阈值 */
  MAX_SIMILARITY: 1,
} as const;


/**
 * RAG 存储路径
 */
export const RAG_STORAGE = {
  /** RAG 数据目录名 */
  FOLDER_NAME: '.ragdb',
  /** 向量索引文件名 */
  INDEX_FILE: 'index.bin',
  /** 元数据文件名 */
  METADATA_FILE: 'metadata.json',
  /** 文本块映射文件名 */
  CHUNKS_FILE: 'chunks.jsonl',
} as const;

/**
 * RAG 事件名称
 */
export const RAG_EVENTS = {
  /** 索引开始 */
  INDEX_START: 'rag:index:start',
  /** 索引进度更新 */
  INDEX_PROGRESS: 'rag:index:progress',
  /** 索引完成 */
  INDEX_COMPLETE: 'rag:index:complete',
  /** 索引错误 */
  INDEX_ERROR: 'rag:index:error',
  /** 搜索开始 */
  SEARCH_START: 'rag:search:start',
  /** 搜索完成 */
  SEARCH_COMPLETE: 'rag:search:complete',
  /** 搜索错误 */
  SEARCH_ERROR: 'rag:search:error',
} as const;

/**
 * RAG 错误消息
 */
export const RAG_ERROR_MESSAGES = {
  CONFIG_INVALID: 'RAG configuration is invalid',
  CONFIG_MISSING: 'RAG configuration is missing',
  DISABLED: 'RAG is disabled in settings',
  NO_WORKSPACE: 'No workspace root configured',
  SOURCE_NOT_FOUND: 'Embedding source not found',
  MODEL_NOT_SPECIFIED: 'Embedding model not specified',
  EMBEDDING_FAILED: 'Failed to generate embedding',
  INDEX_FAILED: 'Failed to index note',
  SEARCH_FAILED: 'Failed to search',
  STORAGE_FAILED: 'Failed to access storage',
  NOT_INITIALIZED: 'RAG service not initialized',
  NO_CONTEXT: 'No relevant context found in notes',
} as const;

export const RAG_ERROR_CODES = {
  INDEX_DIMENSION_MISMATCH: 'INDEX_DIMENSION_MISMATCH',
} as const;

/**
 * 推荐的嵌入模型配置
 */
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

/**
 * RAG 对话提示词模板
 */
export const RAG_CHAT_PROMPTS = {
  SYSTEM: `你是一个专业的笔记助手。请基于提供的笔记内容进行简洁、专业的回答。

必须严格遵守下列规则：
1. 只能使用用户提供的笔记内容进行回答。
2. 在正文中直接回答问题，给出结论和要点，不要转述无关背景，不要包含冗余的解释，保证文本简洁明了。
3. 回答时禁止包含笔记中未提及的外部知识。

笔记内容：
{context}`,

  USER: `问题：{question}

请基于上述笔记内容回答这个问题。`,
} as const;

