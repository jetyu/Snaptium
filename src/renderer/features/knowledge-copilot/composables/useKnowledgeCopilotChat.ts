import { ref } from 'vue';
import { createLogger } from '@renderer/features/logger';
import type { KnowledgeAnswerResult, KnowledgeAnswerStreamEvent } from '@renderer/core/bridge/electronApi';
import { getErrorMessage } from '@shared/utils/error.utils';
import { knowledgeCopilotService } from '../services/knowledge-copilot.service';
import type { KnowledgeCopilotConversationContext } from '@shared/knowledge-copilot.constants';

const knowledgeCopilotChatLogger = createLogger('KnowledgeCopilotChat');

export function useKnowledgeCopilotChat() {
  const isGenerating = ref(false);
  const answer = ref('');
  const error = ref<string | null>(null);
  const usedSearchFallback = ref(false);

  const askQuestionStream = async (
    question: string,
    conversationId: string | undefined,
    context: KnowledgeCopilotConversationContext,
    callbacks: {
      onEvent?: (event: KnowledgeAnswerStreamEvent) => void;
      onDelta?: (text: string) => void;
    } = {},
  ): Promise<KnowledgeAnswerResult> => {
    if (!question.trim()) {
      throw new Error('Question cannot be empty');
    }

    knowledgeCopilotChatLogger.debug(`Starting streaming question flow (length=${question.length})`);
    isGenerating.value = true;
    error.value = null;
    answer.value = '';
    usedSearchFallback.value = false;

    try {
      const result = await knowledgeCopilotService.answerQuestionStream(question, conversationId, context, {
        onEvent: callbacks.onEvent,
        onDelta: (text) => {
          answer.value += text;
          callbacks.onDelta?.(text);
        },
      });

      if (result.success) {
        const generatedAnswer = result.answer || answer.value || 'No answer generated';
        answer.value = generatedAnswer;
        usedSearchFallback.value = result.usedSearchFallback;
        return {
          ...result,
          answer: generatedAnswer,
        };
      }

      throw new Error(result.error || 'Failed to generate answer');
    } catch (err) {
      const message = getErrorMessage(err);
      knowledgeCopilotChatLogger.error(`Error generating streaming answer: ${message}`);
      error.value = message;
      throw err;
    } finally {
      isGenerating.value = false;
      knowledgeCopilotChatLogger.debug('Streaming question flow finished');
    }
  };

  return {
    askQuestionStream,
    isGenerating,
    answer,
    error,
    usedSearchFallback,
  };
}

