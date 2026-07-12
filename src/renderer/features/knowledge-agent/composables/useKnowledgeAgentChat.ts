import { ref } from 'vue';
import { createLogger } from '@renderer/features/logger';
import type { KnowledgeAnswerResult } from '@renderer/core/bridge/electronApi';
import { getErrorMessage } from '@shared/utils/error.utils';
import { knowledgeAgentService } from '../services/knowledge-agent.service';

const knowledgeAgentChatLogger = createLogger('KnowledgeAgentChat');

export function useKnowledgeAgentChat() {
  const isGenerating = ref(false);
  const answer = ref('');
  const error = ref<string | null>(null);
  const usedSearchFallback = ref(false);

  /**
   * Ask a question using the KnowledgeAgent orchestration service
   */
  const askQuestion = async (question: string): Promise<KnowledgeAnswerResult> => {
    if (!question.trim()) {
      throw new Error('Question cannot be empty');
    }

    knowledgeAgentChatLogger.debug(`Starting question flow (length=${question.length})`);
    isGenerating.value = true;
    error.value = null;
    answer.value = '';
    usedSearchFallback.value = false;

    try {
      const result = await knowledgeAgentService.answerQuestion(question);

      if (result.success) {
        const generatedAnswer = result.answer || 'No answer generated';
        answer.value = generatedAnswer;
        usedSearchFallback.value = result.usedSearchFallback;
        return result;
      } else {
        throw new Error(result.error || 'Failed to generate answer');
      }
    } catch (err) {
      const message = getErrorMessage(err);
      knowledgeAgentChatLogger.error(`Error generating answer: ${message}`);
      error.value = message;
      throw err;
    } finally {
      isGenerating.value = false;
      knowledgeAgentChatLogger.debug('Question flow finished');
    }
  };

  return {
    askQuestion,
    isGenerating,
    answer,
    error,
    usedSearchFallback,
  };
}

