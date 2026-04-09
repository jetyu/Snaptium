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

      // 使用 RAG 专用设置，而不是全局 AI Assistant 设置
      const ragConfig = settingsStore.config.rag;
      ragChatLogger.debug(`RAG Config check: sourceId="${ragConfig.ragChatSourceId}", model="${ragConfig.ragChatModel}"`);

      // 只有当 sourceId 存在且不为空时，才认为是启用了服务
      if (ragConfig.ragChatSourceId && ragConfig.ragChatSourceId.trim() !== '') {
        aiSource = settingsStore.config.aiSources.find(
          source => source.id === ragConfig.ragChatSourceId
        );

        // 使用配置的模型，或者回退到 AI 源的默认模型
        modelName = ragConfig.ragChatModel && ragConfig.ragChatModel.trim() !== ''
          ? ragConfig.ragChatModel
          : aiSource?.aiModel;

        ragChatLogger.debug(`RAG chat resolution: Source=${aiSource?.name || 'NOT FOUND'}, Model=${modelName || 'NOT FOUND'}`);
      } else {
        ragChatLogger.debug('RAG chat service is disabled (Source ID is empty).');
      }

      // 如果未配置 AI 源或模型，直接返回检索结果（跳过 AI API 调用）
      if (!aiSource || !modelName) {
        ragChatLogger.debug('RAG chat is disabled or missing configuration, falling back to search results only.');
        const searchResultsSummary = searchResults
          .map((res, idx) => `[${idx + 1}] ${res.noteTitle || 'Untitled'}:\n${res.chunk.content}`)
          .join('\n\n');

        answer.value = `${t('message.rag.noChatModel')}\n\n${searchResultsSummary}`;
        return answer.value;
      }

      ragChatLogger.debug(`Calling AI API with source "${aiSource.name}" and model "${modelName}"`);

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
