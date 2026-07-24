import { KNOWLEDGE_COPILOT_CONVERSATION_LIMITS, type KnowledgeCopilotConversationContext, type KnowledgeCopilotConversationTurn } from '../../shared/knowledge-copilot.constants.js';

export function formatKnowledgeCopilotConversationHistory(history: KnowledgeCopilotConversationTurn[]): string {
  return history.map((turn, index) => [
    `Turn ${index + 1} (${turn.mode})`,
    `User: ${turn.query}`,
    `Assistant: ${turn.answer}`,
  ].join('\n')).join('\n\n');
}

export function getKnowledgeCopilotRecentHistory(context: KnowledgeCopilotConversationContext): KnowledgeCopilotConversationTurn[] {
  return context.turns.slice(-KNOWLEDGE_COPILOT_CONVERSATION_LIMITS.CONTEXT_TURNS);
}

export function getKnowledgeCopilotSummaryCandidates(context: KnowledgeCopilotConversationContext): KnowledgeCopilotConversationTurn[] {
  const olderTurns = context.turns.slice(0, -KNOWLEDGE_COPILOT_CONVERSATION_LIMITS.CONTEXT_TURNS);
  if (!context.summaryUpToQuestionId) return olderTurns;
  const coveredIndex = olderTurns.findIndex((turn) => turn.id === context.summaryUpToQuestionId);
  return coveredIndex < 0 ? olderTurns : olderTurns.slice(coveredIndex + 1);
}

export function formatKnowledgeCopilotConversationContext(context: KnowledgeCopilotConversationContext): string {
  return [
    context.summary ? `Earlier conversation summary:\n${context.summary}` : '',
    formatKnowledgeCopilotConversationHistory(getKnowledgeCopilotRecentHistory(context)),
  ].filter(Boolean).join('\n\n');
}
