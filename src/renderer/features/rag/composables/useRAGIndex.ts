/**
 * useRAGIndex Composable
 * 
 * 管理 RAG 索引的组合式函数
 */

import { computed, onMounted, onUnmounted } from 'vue';
import { useRAGStore } from '../store/rag.store';
import { useRAGConfig } from './useRAGConfig';
import { createLogger } from '@renderer/features/logger';

const ragIndexLogger = createLogger('useRAGIndex');

export function useRAGIndex() {
  const ragStore = useRAGStore();
  const { isEnabled, isConfigured, ragConfig } = useRAGConfig();

  // 索引状态
  const indexStatus = computed(() => ragStore.indexStatus);
  const isIndexing = computed(() => indexStatus.value.isIndexing);
  const progress = computed(() => indexStatus.value.progress);

  /**
   * 索引单个笔记
   */
  const indexNote = async (noteId: string, noteTitle: string, content: string) => {
    if (!isEnabled.value || !isConfigured.value) {
      ragIndexLogger.warn('RAG is not enabled or configured, skipping indexing');
      return;
    }

    try {
      await ragStore.indexNote(
        noteId,
        noteTitle,
        content,
        ragConfig.value.chunkSize,
        ragConfig.value.chunkOverlap
      );
    } catch (error) {
      ragIndexLogger.error(`Failed to index note: ${error}`);
      throw error;
    }
  };

  /**
   * 重建所有索引
   * @param notes - 笔记列表
   */
  const rebuildIndex = async (
    notes: Array<{ id: string; title: string; content: string }>,
    reason: 'manual' | 'auto-index' = 'manual',
    fullRebuild = false,
  ) => {
    if (!isEnabled.value || !isConfigured.value) {
      throw new Error('RAG is not enabled or configured');
    }

    try {
      await ragStore.rebuildIndex(
        notes,
        ragConfig.value.chunkSize,
        ragConfig.value.chunkOverlap,
        reason,
        fullRebuild,
      );
    } catch (error) {
      ragIndexLogger.error(`Failed to rebuild index: ${error}`);
      throw error;
    }
  };

  /**
   * 删除笔记索引
   */
  const deleteNoteIndex = async (noteId: string) => {
    if (!isEnabled.value || !isConfigured.value) {
      ragIndexLogger.warn('RAG is not enabled or configured, skipping deletion');
      return;
    }

    try {
      await ragStore.deleteNoteIndex(noteId);
    } catch (error) {
      ragIndexLogger.error(`Failed to delete note index: ${error}`);
      throw error;
    }
  };

  /**
   * 清除整库索引
   */
  const clearIndex = async () => {
    if (!isEnabled.value || !isConfigured.value) {
      ragIndexLogger.warn('RAG is not enabled or configured, skipping clear index');
      return;
    }

    try {
      await ragStore.clearIndex();
    } catch (error) {
      ragIndexLogger.error(`Failed to clear index: ${error}`);
      throw error;
    }
  };

  /**
   * 获取索引状态
   */
  const refreshStatus = async () => {
    try {
      await ragStore.getStatus();
    } catch (error) {
      ragIndexLogger.error(`Failed to refresh status: ${error}`);
    }
  };

  // 定期刷新状态
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
