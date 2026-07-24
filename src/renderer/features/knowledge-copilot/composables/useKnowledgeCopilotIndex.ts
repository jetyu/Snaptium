/**
 * useKnowledgeCopilotIndex Composable
 * 
 */

import { computed, onMounted, onUnmounted } from 'vue';
import { useKnowledgeCopilotStore } from '../store/knowledge-copilot.store';
import { useKnowledgeCopilotConfig } from './useKnowledgeCopilotConfig';
import { createLogger } from '@renderer/features/logger';

const knowledgeCopilotIndexLogger = createLogger('useKnowledgeCopilotIndex');

export function useKnowledgeCopilotIndex() {
  const knowledgeCopilotStore = useKnowledgeCopilotStore();
  const { isEnabled, isConfigured, knowledgeCopilotConfig } = useKnowledgeCopilotConfig();

  // 绱㈠紩鐘舵€?
  const indexStatus = computed(() => knowledgeCopilotStore.indexStatus);
  const isIndexing = computed(() => indexStatus.value.isIndexing);
  const progress = computed(() => indexStatus.value.progress);

  /**
   * 绱㈠紩鍗曚釜绗旇
   */
  const indexNote = async (noteId: string, noteTitle: string, content: string) => {
    if (!isEnabled.value || !isConfigured.value) {
      knowledgeCopilotIndexLogger.warn('KnowledgeCopilot is not enabled or configured, skipping indexing');
      return;
    }

    try {
      await knowledgeCopilotStore.indexNote(
        noteId,
        noteTitle,
        content,
        knowledgeCopilotConfig.value.chunkSize,
        knowledgeCopilotConfig.value.chunkOverlap
      );
    } catch (error) {
      knowledgeCopilotIndexLogger.error(`Failed to index note: ${error}`);
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
      throw new Error('KnowledgeCopilot is not enabled or configured');
    }

    try {
      await knowledgeCopilotStore.rebuildIndex(
        notes,
        knowledgeCopilotConfig.value.chunkSize,
        knowledgeCopilotConfig.value.chunkOverlap,
        reason,
        fullRebuild,
      );
    } catch (error) {
      knowledgeCopilotIndexLogger.error(`Failed to rebuild index: ${error}`);
      throw error;
    }
  };

  /**
   * 鍒犻櫎绗旇绱㈠紩
   */
  const deleteNoteIndex = async (noteId: string) => {
    if (!isEnabled.value || !isConfigured.value) {
      knowledgeCopilotIndexLogger.warn('KnowledgeCopilot is not enabled or configured, skipping deletion');
      return;
    }

    try {
      await knowledgeCopilotStore.deleteNoteIndex(noteId);
    } catch (error) {
      knowledgeCopilotIndexLogger.error(`Failed to delete note index: ${error}`);
      throw error;
    }
  };

  /**
   * 娓呴櫎鏁村簱绱㈠紩
   */
  const clearIndex = async () => {
    if (!isEnabled.value || !isConfigured.value) {
      knowledgeCopilotIndexLogger.warn('KnowledgeCopilot is not enabled or configured, skipping clear index');
      return;
    }

    try {
      await knowledgeCopilotStore.clearIndex();
    } catch (error) {
      knowledgeCopilotIndexLogger.error(`Failed to clear index: ${error}`);
      throw error;
    }
  };

  /**
   * 鑾峰彇绱㈠紩鐘舵€?
   */
  const refreshStatus = async () => {
    try {
      await knowledgeCopilotStore.getStatus();
    } catch (error) {
      knowledgeCopilotIndexLogger.error(`Failed to refresh status: ${error}`);
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

