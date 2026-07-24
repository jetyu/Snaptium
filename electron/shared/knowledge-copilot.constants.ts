export const KNOWLEDGE_COPILOT_CONVERSATION_LIMITS = {
  VISIBLE_TURNS: 12,
  CONTEXT_TURNS: 6,
  THREADS: 30,
  QUESTION_LENGTH: 1200,
  ANSWER_LENGTH: 1200,
  SUMMARY_LENGTH: 2400,
} as const;

export type KnowledgeCopilotConversationMode = 'ask' | 'agent-task';

export interface KnowledgeCopilotConversationTurn {
  id: string;
  mode: KnowledgeCopilotConversationMode;
  query: string;
  answer: string;
}

export interface KnowledgeCopilotConversationContext {
  summary?: string;
  summaryUpToQuestionId?: string;
  turns: KnowledgeCopilotConversationTurn[];
}
