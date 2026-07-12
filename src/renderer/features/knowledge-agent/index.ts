export { useKnowledgeAgentStore } from './store/knowledge-agent.store';
export type { TextChunk, IndexStatus } from './store/knowledge-agent.store';

export { knowledgeAgentService } from './services/knowledge-agent.service';
export type { IndexNoteRequest } from './services/knowledge-agent.service';

export { useKnowledgeAgentConfig } from './composables/useKnowledgeAgentConfig';
export { useKnowledgeAgentIndex } from './composables/useKnowledgeAgentIndex';
export { useKnowledgeAgentInitialization } from './composables/useKnowledgeAgentInitialization';
export { useKnowledgeAgentChat } from './composables/useKnowledgeAgentChat';
export { useKnowledgeAgentTask } from './composables/useKnowledgeAgentTask';

export {
  DEFAULT_KNOWLEDGE_AGENT_CONFIG,
  KNOWLEDGE_AGENT_CONSTRAINTS,
  KNOWLEDGE_AGENT_EVENTS,
  KNOWLEDGE_AGENT_ERROR_MESSAGES,
  RECOMMENDED_EMBEDDING_MODELS,
} from './constants/knowledge-agent.constants';
