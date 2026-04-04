import { ref } from 'vue';
import { useRAGSearch } from './useRAGSearch';
import { useSettingsStore } from '@renderer/features/settings/store/settings.store';
import { RAG_CHAT_PROMPTS } from '../constants/rag.constants';
import { createLogger } from '@renderer/features/logger';
import { ragService } from '../services/rag.service';
import { useI18n } from 'vue-i18n';

const ragChatLogger = createLogger('RAGChat');

export function useRAGChat() {
  const { search } = useRAGSearch();
  const settingsStore = useSettingsStore();
  const { t } = useI18n();

  const isGenerating = ref(false);
  const answer = ref('');
  const error = ref<string | null>(null);

  const askQuestion = async (question: string): Promise<string> => {
    if (!question.trim()) {
      throw new Error('Question cannot be empty');
    }

    ragChatLogger.debug(`Starting question flow (length=${question.length})`);
    isGenerating.value = true;
    error.value = null;
    answer.value = '';

    try {
      ragChatLogger.debug('Searching for relevant notes');
      const searchResults = await search(question);
      ragChatLogger.debug(`Found ${searchResults.length} search results`);

      if (searchResults.length === 0) {
        const noResultsMessage = 'No relevant note content found.';
        answer.value = noResultsMessage;
        return noResultsMessage;
      }

      const context = searchResults
        .map((result, index) => {
          const content = result.chunk.content || '[Empty content]';
          const title = result.noteTitle || 'Untitled Note';
          return `Source [${index + 1}] (${title}):\n${content}`;
        })
        .join('\n\n---\n\n');

      ragChatLogger.debug(`Built answer context (length=${context.length}, sources=${searchResults.length})`);

      let aiSource;
      let modelName;

      // 1. Prioritize AI Assistant for Chat
      const aiConfig = settingsStore.config.aiAssistant;
      if (aiConfig.sourceId && aiConfig.model) {
        aiSource = settingsStore.config.aiSources.find(
          source => source.id === aiConfig.sourceId
        );
        modelName = aiConfig.model;
        ragChatLogger.debug('Using AI Assistant for chat');
      } else {
        ragChatLogger.debug('No valid AI Assistant chat configuration found');
      }

      ragChatLogger.debug(`Using AI source "${aiSource?.name || 'N/A'}" with model "${modelName || 'N/A'}"`);

      if (!modelName) {
        ragChatLogger.debug('No chat model configured, returning search results directly');
        const searchResultsSummary = searchResults
          .map((res, idx) => `[${idx + 1}] ${res.noteTitle || 'Untitled'}:\n${res.chunk.content}`)
          .join('\n\n');
        answer.value = `${t('message.rag.noChatModel')}\n\n${searchResultsSummary}`;
        return answer.value;
      }

      if (!aiSource) {
        throw new Error('AI Service not found');
      }

      const systemPrompt = RAG_CHAT_PROMPTS.SYSTEM.replace('{context}', context);
      const userPrompt = RAG_CHAT_PROMPTS.USER.replace('{question}', question);

      ragChatLogger.debug('Calling AI API');

      const result = await ragService.generateAnswer({
        endpoint: aiSource.endpoint,
        apiKey: aiSource.apiKey,
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });

      ragChatLogger.debug(`AI API response received (success=${!!result?.success})`);

      if (!result?.success) {
        throw new Error(result?.error || 'AI API call failed');
      }

      const generatedAnswer = result.answer || 'Unable to generate an answer';
      ragChatLogger.debug(`Generated answer (length=${generatedAnswer.length})`);

      answer.value = generatedAnswer;
      return generatedAnswer;
    } catch (err) {
      ragChatLogger.error(`Error generating answer: ${err instanceof Error ? err.message : String(err)}`);
      error.value = err instanceof Error ? err.message : 'Unknown error';
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
  };
}
