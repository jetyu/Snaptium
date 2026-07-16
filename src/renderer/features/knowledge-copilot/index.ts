export { useKnowledgeCopilotStore } from './store/knowledge-copilot.store';
export type { TextChunk, IndexStatus } from './store/knowledge-copilot.store';

export { knowledgeCopilotService } from './services/knowledge-copilot.service';
export type { IndexNoteRequest } from './services/knowledge-copilot.service';

export { useKnowledgeCopilotConfig } from './composables/useKnowledgeCopilotConfig';
export { useKnowledgeCopilotIndex } from './composables/useKnowledgeCopilotIndex';
export { useKnowledgeCopilotInitialization } from './composables/useKnowledgeCopilotInitialization';
export { useKnowledgeCopilotChat } from './composables/useKnowledgeCopilotChat';
export { useKnowledgeCopilotTask } from './composables/useKnowledgeCopilotTask';

export {
  DEFAULT_KNOWLEDGE_COPILOT_CONFIG,
  KNOWLEDGE_COPILOT_CONSTRAINTS,
  KNOWLEDGE_COPILOT_EVENTS,
  KNOWLEDGE_COPILOT_ERROR_MESSAGES,
} from './constants/knowledge-copilot.constants';
