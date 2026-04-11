/**
 * RAG Store
 * 
 * 管理 RAG 功能的全局状态
 * 类型定义在此文件中（遵循项目规范）
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { ragService } from '../services/rag.service';
import { createLogger } from '@renderer/features/logger';
import { useSettingsStore } from '../../settings/store/settings.store';

const ragLogger = createLogger('RAGStore');

/**
 * 文本块接口
 */
export interface TextChunk {
  id: string;
  noteId: string;
  content: string;
  startPos: number;
  endPos: number;
  metadata?: Record<string, any>;
}

/**
 * 搜索结果接口
 */
export interface SearchResult {
  chunk: TextChunk;
  score: number;
  noteTitle?: string;
}

/**
 * 索引状态接口
 */
export interface IndexStatus {
  isIndexing: boolean;
  indexedNotes: number;
  totalNotes: number;
  totalChunks: number;
  progress: number;
  lastIndexedAt: number | null;
  error: string | null;
  rebuildReason: 'manual' | 'auto-index' | null;
}

export const useRAGStore = defineStore('rag', () => {
  // 索引状态
  const indexStatus = ref<IndexStatus>({
    isIndexing: false,
    indexedNotes: 0,
    totalNotes: 0,
    totalChunks: 0,
    progress: 0,
    lastIndexedAt: null,
    error: null,
    rebuildReason: null,
  });

  // 搜索结果
  const searchResults = ref<SearchResult[]>([]);
  const isSearching = ref(false);

  /**
   * 索引单个笔记
   */
  const indexNote = async (noteId: string, noteTitle: string, content: string, chunkSize: number, chunkOverlap: number) => {
    try {
      const result = await ragService.indexNote({
        noteId,
        noteTitle,
        content,
        chunkSize,
        chunkOverlap
      });

      if (result.success) {
        ragLogger.info(`Indexed note: ${noteId}, chunks: ${result.chunksIndexed}`);
        const lastIndexedDate = Date.now();
        indexStatus.value.lastIndexedAt = lastIndexedDate;
        const settingsStore = useSettingsStore();
        settingsStore.updateRAGSetting('lastIndexedAt', lastIndexedDate);
      } else {
        throw new Error(result.error || 'Failed to index note');
      }
    } catch (error) {
      ragLogger.error(`Failed to index note ${noteId}: ${error}`);
      throw error;
    }
  };

  /**
   * 重建所有索引
   */
  const rebuildIndex = async (
    notes: Array<{ id: string; title: string; content: string }>,
    chunkSize: number,
    chunkOverlap: number,
    reason: IndexStatus['rebuildReason'] = 'manual'
  ) => {
    indexStatus.value.isIndexing = true;
    indexStatus.value.error = null;
    indexStatus.value.totalNotes = notes.length;
    indexStatus.value.indexedNotes = 0;
    indexStatus.value.totalChunks = 0;
    indexStatus.value.rebuildReason = reason;

    try {
      const result = await ragService.rebuildIndex(notes, {
        chunkSize,
        chunkOverlap,
        onProgress: (p) => {
          indexStatus.value.indexedNotes = p.success;
          indexStatus.value.progress = Math.round((p.current / p.total) * 100);
        }
      });

      indexStatus.value.indexedNotes = result.successCount;
      const lastIndexedDate = Date.now();
      indexStatus.value.lastIndexedAt = lastIndexedDate;
      const settingsStore = useSettingsStore();
      settingsStore.updateRAGSetting('lastIndexedAt', lastIndexedDate);
      indexStatus.value.progress = 100;
      const status = await ragService.getStatus();
      if (status.success) {
        indexStatus.value.totalChunks = status.totalChunks || 0;
      }
      ragLogger.info(`Index rebuilt: ${result.successCount} notes succeeded, ${result.failCount} failed`);
    } catch (error) {
      indexStatus.value.error = String(error);
      ragLogger.error(`Failed to rebuild index: ${error}`);
      throw error;
    } finally {
      indexStatus.value.isIndexing = false;
      if (indexStatus.value.error) {
        indexStatus.value.rebuildReason = null;
      }
    }
  };

  /**
   * 语义搜索
   */
  const search = async (query: string, topK: number, threshold: number) => {
    isSearching.value = true;
    searchResults.value = [];

    try {
      const response = await ragService.search({ query, topK, similarityThreshold: threshold });

      if (response.success) {
        const results = response.results || [];
        searchResults.value = results;
        ragLogger.info(`Search completed: ${results.length} results`);
        return results;
      } else {
        throw new Error(response.error || 'Search failed');
      }
    } catch (error) {
      ragLogger.error(`Search failed: ${error}`);
      throw error;
    } finally {
      isSearching.value = false;
    }
  };

  /**
   * 获取索引状态
   */
  const getStatus = async () => {
    try {
      const response = await ragService.getStatus();

      if (response.success) {
        // 更新索引状态
        indexStatus.value.totalChunks = response.totalChunks || 0;
        ragLogger.info(`Status: ${response.totalChunks} chunks indexed`);
      }

      return response;
    } catch (error) {
      ragLogger.error(`Failed to get status: ${error}`);
      throw error;
    }
  };

  /**
   * 删除笔记索引
   */
  const deleteNoteIndex = async (noteId: string) => {
    try {
      const result = await ragService.deleteNoteIndex(noteId);

      if (result.success) {
        ragLogger.info(`Deleted index for note: ${noteId}`);
      } else {
        throw new Error(result.error || 'Failed to delete note index');
      }
    } catch (error) {
      ragLogger.error(`Failed to delete note index ${noteId}: ${error}`);
      throw error;
    }
  };

  /**
   * 清除所有索引数据
   */
  const clearIndex = async () => {
    try {
      const result = await ragService.clearIndex();

      if (result.success) {
        indexStatus.value.totalChunks = 0;
        indexStatus.value.indexedNotes = 0;
        indexStatus.value.lastIndexedAt = 0;
        const settingsStore = useSettingsStore();
        settingsStore.updateRAGSetting('lastIndexedAt', indexStatus.value.lastIndexedAt);
        ragLogger.info('Cleared all index data');
      } else {
        throw new Error(result.error || 'Failed to clear index');
      }
    } catch (error) {
      ragLogger.error(`Failed to clear index: ${error}`);
      throw error;
    }
  };

  /**
   * 清除搜索结果
   */
  const clearSearchResults = () => {
    searchResults.value = [];
  };

  return {
    // State
    indexStatus,
    searchResults,
    isSearching,

    // Actions
    indexNote,
    rebuildIndex,
    search,
    getStatus,
    deleteNoteIndex,
    clearIndex,
    clearSearchResults,
  };
});
