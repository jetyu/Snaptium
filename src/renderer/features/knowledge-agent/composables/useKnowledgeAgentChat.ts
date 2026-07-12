import { ref } from 'vue';
import { createLogger } from '@renderer/features/logger';
import type { KnowledgeAnswerResult, KnowledgeAnswerStreamEvent } from '@renderer/core/bridge/electronApi';
import { getErrorMessage } from '@shared/utils/error.utils';
import { knowledgeAgentService } from '../services/knowledge-agent.service';

const knowledgeAgentChatLogger = createLogger('KnowledgeAgentChat');

export function useKnowledgeAgentChat() {
  const isGenerating = ref(false);
  const answer = ref('');
  const error = ref<string | null>(null);
  const usedSearchFallback = ref(false);

  const askQuestionStream = async (
    question: string,
    callbacks: {
      onEvent?: (event: KnowledgeAnswerStreamEvent) => void;
      onDelta?: (text: string) => void;
    } = {},
  ): Promise<KnowledgeAnswerResult> => {
    if (!question.trim()) {
      throw new Error('Question cannot be empty');
    }

    knowledgeAgentChatLogger.debug(`Starting streaming question flow (length=${question.length})`);
    isGenerating.value = true;
    error.value = null;
    answer.value = '';
    usedSearchFallback.value = false;

    try {
      const result = await knowledgeAgentService.answerQuestionStream(question, {
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
      knowledgeAgentChatLogger.error(`Error generating streaming answer: ${message}`);
      error.value = message;
      throw err;
    } finally {
      isGenerating.value = false;
      knowledgeAgentChatLogger.debug('Streaming question flow finished');
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

