/**
 * useRAGSearch Composable
 * 
 * 管理 RAG 语义搜索的组合式函数
 */

import { computed, ref } from 'vue';
import { useRAGStore } from '../store/rag.store';
import { useRAGConfig } from './useRAGConfig';
import { createLogger } from '@renderer/features/logger';

const ragSearchLogger = createLogger('useRAGSearch');

export function useRAGSearch() {
  const ragStore = useRAGStore();
  const { isEnabled, isConfigured, ragConfig } = useRAGConfig();

  // 搜索状态
  const searchResults = computed(() => ragStore.searchResults);
  const isSearching = computed(() => ragStore.isSearching);
  const searchQuery = ref('');

  /**
   * 执行语义搜索
   */
  const search = async (query: string, topK?: number, threshold?: number) => {
    if (!isEnabled.value || !isConfigured.value) {
      ragSearchLogger.warn('RAG is not enabled or configured, skipping search');
      return [];
    }

    if (!query.trim()) {
      ragSearchLogger.warn('Empty search query');
      return [];
    }

    searchQuery.value = query;

    try {
      const results = await ragStore.search(
        query,
        topK ?? ragConfig.value.topK,
        threshold ?? ragConfig.value.similarityThreshold
      );
      return results;
    } catch (error) {
      ragSearchLogger.error(`Search failed: ${error}`);
      throw error;
    }
  };

  /**
   * 清除搜索结果
   */
  const clearResults = () => {
    ragStore.clearSearchResults();
    searchQuery.value = '';
  };

  /**
   * 获取笔记的相关上下文
   * 用于 AI 助手增强
   */
  const getContextForNote = async (noteId: string, query: string, topK = 3) => {
    if (!isEnabled.value || !isConfigured.value) {
      return [];
    }

    try {
      const results = await ragStore.search(query, topK, ragConfig.value.similarityThreshold);
      // 排除当前笔记
      return results.filter(r => r.chunk.noteId !== noteId);
    } catch (error) {
      ragSearchLogger.error(`Failed to get context: ${error}`);
      return [];
    }
  };

  return {
    // State
    searchResults,
    isSearching,
    searchQuery,

    // Actions
    search,
    clearResults,
    getContextForNote,
  };
}
