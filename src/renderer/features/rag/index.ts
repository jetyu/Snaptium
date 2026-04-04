/**
 * RAG Feature Module
 * 
 * 导出 RAG 功能的所有公共接口
 */

// Store
export { useRAGStore } from './store/rag.store';
export type { TextChunk, SearchResult, IndexStatus } from './store/rag.store';

// Services
export { ragService } from './services/rag.service';
export type { IndexNoteRequest, SearchRequest } from './services/rag.service';

// Composables
export { useRAGConfig } from './composables/useRAGConfig';
export { useRAGIndex } from './composables/useRAGIndex';
export { useRAGSearch } from './composables/useRAGSearch';
export { useRAGInitialization } from './composables/useRAGInitialization';
export { useRAGChat } from './composables/useRAGChat';

// Constants
export {
  DEFAULT_RAG_CONFIG,
  RAG_CONSTRAINTS,
  RAG_STORAGE,
  RAG_EVENTS,
  RAG_ERROR_MESSAGES,
  RECOMMENDED_EMBEDDING_MODELS,
} from './constants/rag.constants';
