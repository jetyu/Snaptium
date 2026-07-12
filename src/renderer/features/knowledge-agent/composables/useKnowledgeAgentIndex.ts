/**
 * useKnowledgeAgentIndex Composable
 * 
 * 绠＄悊 KnowledgeAgent 绱㈠紩鐨勭粍鍚堝紡鍑芥暟
 */

import { computed, onMounted, onUnmounted } from 'vue';
import { useKnowledgeAgentStore } from '../store/knowledge-agent.store';
import { useKnowledgeAgentConfig } from './useKnowledgeAgentConfig';
import { createLogger } from '@renderer/features/logger';

const knowledgeAgentIndexLogger = createLogger('useKnowledgeAgentIndex');

export function useKnowledgeAgentIndex() {
  const knowledgeAgentStore = useKnowledgeAgentStore();
  const { isEnabled, isConfigured, knowledgeAgentConfig } = useKnowledgeAgentConfig();

  // 绱㈠紩鐘舵€?
  const indexStatus = computed(() => knowledgeAgentStore.indexStatus);
  const isIndexing = computed(() => indexStatus.value.isIndexing);
  const progress = computed(() => indexStatus.value.progress);

  /**
   * 绱㈠紩鍗曚釜绗旇
   */
  const indexNote = async (noteId: string, noteTitle: string, content: string) => {
    if (!isEnabled.value || !isConfigured.value) {
      knowledgeAgentIndexLogger.warn('KnowledgeAgent is not enabled or configured, skipping indexing');
      return;
    }

    try {
      await knowledgeAgentStore.indexNote(
        noteId,
        noteTitle,
        content,
        knowledgeAgentConfig.value.chunkSize,
        knowledgeAgentConfig.value.chunkOverlap
      );
    } catch (error) {
      knowledgeAgentIndexLogger.error(`Failed to index note: ${error}`);
      throw error;
    }
  };

  /**
   * 閲嶅缓鎵€鏈夌储寮?
   * @param notes - 绗旇鍒楄〃
   */
  const rebuildIndex = async (
    notes: Array<{ id: string; title: string; content: string }>,
    reason: 'manual' | 'auto-index' = 'manual',
    fullRebuild = false,
  ) => {
    if (!isEnabled.value || !isConfigured.value) {
      throw new Error('KnowledgeAgent is not enabled or configured');
    }

    try {
      await knowledgeAgentStore.rebuildIndex(
        notes,
        knowledgeAgentConfig.value.chunkSize,
        knowledgeAgentConfig.value.chunkOverlap,
        reason,
        fullRebuild,
      );
    } catch (error) {
      knowledgeAgentIndexLogger.error(`Failed to rebuild index: ${error}`);
      throw error;
    }
  };

  /**
   * 鍒犻櫎绗旇绱㈠紩
   */
  const deleteNoteIndex = async (noteId: string) => {
    if (!isEnabled.value || !isConfigured.value) {
      knowledgeAgentIndexLogger.warn('KnowledgeAgent is not enabled or configured, skipping deletion');
      return;
    }

    try {
      await knowledgeAgentStore.deleteNoteIndex(noteId);
    } catch (error) {
      knowledgeAgentIndexLogger.error(`Failed to delete note index: ${error}`);
      throw error;
    }
  };

  /**
   * 娓呴櫎鏁村簱绱㈠紩
   */
  const clearIndex = async () => {
    if (!isEnabled.value || !isConfigured.value) {
      knowledgeAgentIndexLogger.warn('KnowledgeAgent is not enabled or configured, skipping clear index');
      return;
    }

    try {
      await knowledgeAgentStore.clearIndex();
    } catch (error) {
      knowledgeAgentIndexLogger.error(`Failed to clear index: ${error}`);
      throw error;
    }
  };

  /**
   * 鑾峰彇绱㈠紩鐘舵€?
   */
  const refreshStatus = async () => {
    try {
      await knowledgeAgentStore.getStatus();
    } catch (error) {
      knowledgeAgentIndexLogger.error(`Failed to refresh status: ${error}`);
    }
  };

  // 瀹氭湡鍒锋柊鐘舵€?
  let statusInterval: ReturnType<typeof setInterval> | null = null;

  onMounted(() => {
    if (isEnabled.value) {
      refreshStatus();
      statusInterval = setInterval(refreshStatus, 30000);
    }
  });

  onUnmounted(() => {
    if (statusInterval) {
      clearInterval(statusInterval);
    }
  });

  return {
    // State
    indexStatus,
    isIndexing,
    progress,

    // Actions
    indexNote,
    rebuildIndex,
    deleteNoteIndex,
    clearIndex,
    refreshStatus,
  };
}

