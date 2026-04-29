import { ref } from 'vue';
import { createLogger } from '@renderer/features/logger';
import { getErrorMessage } from '@shared/utils/error.utils';
import { ragService } from '../services/rag.service';

const ragChatLogger = createLogger('RAGChat');

export function useRAGChat() {
  const isGenerating = ref(false);
  const answer = ref('');
  const error = ref<string | null>(null);
  const usedSearchFallback = ref(false);

  /**
   * Ask a question using the RAG orchestration service
   */
  const askQuestion = async (question: string): Promise<string> => {
    if (!question.trim()) {
      throw new Error('Question cannot be empty');
    }

    ragChatLogger.debug(`Starting question flow (length=${question.length})`);
    isGenerating.value = true;
    error.value = null;
    answer.value = '';
    usedSearchFallback.value = false;

    try {
      const result = await ragService.askQuestion(question);

      if (result.success) {
        const generatedAnswer = result.answer || 'No answer generated';
        answer.value = generatedAnswer;
        usedSearchFallback.value = Boolean(result.usedSearchFallback);
        return generatedAnswer;
      } else {
        throw new Error(result.error || 'Failed to generate answer');
      }
    } catch (err) {
      const message = getErrorMessage(err);
      ragChatLogger.error(`Error generating answer: ${message}`);
      error.value = message;
      throw err;
    } finally {
      isGenerating.value = false;
      ragChatLogger.debug('Question flow finished');
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
