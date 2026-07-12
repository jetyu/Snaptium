/**
 * KnowledgeAgent Store
 *
 * Manages KnowledgeAgent indexing/search state and orchestration-level cache metadata.
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { knowledgeAgentService } from '../services/knowledge-agent.service';
import { createLogger } from '@renderer/features/logger';
import { getErrorMessage } from '@shared/utils/error.utils';
import { useSettingsStore } from '../../settings/store/settings.store';

const knowledgeAgentLogger = createLogger('KnowledgeAgentStore');

export interface TextChunk {
  id: string;
  noteId: string;
  content: string;
  startPos: number;
  endPos: number;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface IndexStatus {
  isIndexing: boolean;
  indexedNotes: number;
  totalNotes: number;
  totalChunks: number;
  progress: number;
  lastIndexedAt: number | null;
  error: string | null;
  rebuildReason: 'manual' | 'auto-index' | null;
  skippedNotes: number;
}

interface NoteIndexPayload {
  id: string;
  title: string;
  content: string;
}

interface StatusCachePayload {
  timestamp: number;
  isInitialized: boolean;
  totalChunks: number;
  tableName?: string;
  error?: string;
}

const INDEX_CONCURRENCY = 3;
const STATUS_CACHE_TTL_MS = 12_000;

function hashText(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function buildIndexSignature(
  note: NoteIndexPayload,
  chunkSize: number,
  chunkOverlap: number,
  embeddingModel: string,
): string {
  const contentHash = hashText(`${note.title || ''}\u001E${note.content || ''}`);
  return [embeddingModel || '', String(chunkSize), String(chunkOverlap), contentHash].join('\u001F');
}

async function runWithConcurrency<T>(tasks: Array<() => Promise<T>>, concurrency: number): Promise<T[]> {
  if (tasks.length === 0) {
    return [];
  }

  const safeConcurrency = Math.max(1, concurrency);
  const results = new Array<T>(tasks.length);
  let nextIndex = 0;

  const workers = Array.from({ length: safeConcurrency }, async () => {
    while (true) {
      const current = nextIndex;
      nextIndex += 1;
      if (current >= tasks.length) {
        break;
      }
      results[current] = await tasks[current]();
    }
  });

  await Promise.all(workers);
  return results;
}

export const useKnowledgeAgentStore = defineStore('knowledgeAgent', () => {
  const indexStatus = ref<IndexStatus>({
    isIndexing: false,
    indexedNotes: 0,
    totalNotes: 0,
    totalChunks: 0,
    progress: 0,
    lastIndexedAt: null,
    error: null,
    rebuildReason: null,
    skippedNotes: 0,
  });

  const statusCache = ref<StatusCachePayload | null>(null);

  const indexNote = async (
    noteId: string,
    noteTitle: string,
    content: string,
    chunkSize: number,
    chunkOverlap: number,
  ) => {
    try {
      const result = await knowledgeAgentService.indexNote({
        noteId,
        noteTitle,
        content,
        chunkSize,
        chunkOverlap,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to index note');
      }

      knowledgeAgentLogger.info(`Indexed note: ${noteId}, chunks: ${result.chunksIndexed}`);
      const lastIndexedDate = Date.now();
      indexStatus.value.lastIndexedAt = lastIndexedDate;

      const settingsStore = useSettingsStore();
      const knowledgeAgentConfig = settingsStore.config.knowledgeAgent;
      const previousChunkCounts = knowledgeAgentConfig.indexChunkCounts || {};
      const previousSignatures = knowledgeAgentConfig.indexSignatures || {};
      const previousCount = Number(previousChunkCounts[noteId] || 0);
      const nextCount = Number(result.chunksIndexed || 0);
      const nextTotalChunks = Math.max(0, Number(knowledgeAgentConfig.cachedTotalChunks || 0) - previousCount + nextCount);
      const nextSignature = buildIndexSignature(
        { id: noteId, title: noteTitle, content },
        chunkSize,
        chunkOverlap,
        String(knowledgeAgentConfig.embeddingModel || ''),
      );

      await settingsStore.saveSettings({
        knowledgeAgent: {
          ...knowledgeAgentConfig,
          lastIndexedAt: lastIndexedDate,
          indexSignatures: {
            ...previousSignatures,
            [noteId]: nextSignature,
          },
          indexChunkCounts: {
            ...previousChunkCounts,
            [noteId]: nextCount,
          },
          cachedTotalChunks: nextTotalChunks,
        },
      });

      indexStatus.value.totalChunks = nextTotalChunks;
      statusCache.value = {
        timestamp: Date.now(),
        isInitialized: true,
        totalChunks: nextTotalChunks,
      };
    } catch (error) {
      knowledgeAgentLogger.error(`Failed to index note ${noteId}: ${getErrorMessage(error)}`);
      throw error;
    }
  };

  const rebuildIndex = async (
    notes: NoteIndexPayload[],
    chunkSize: number,
    chunkOverlap: number,
    reason: IndexStatus['rebuildReason'] = 'manual',
    fullRebuild = false,
  ) => {
    const settingsStore = useSettingsStore();
    const knowledgeAgentConfig = settingsStore.config.knowledgeAgent;
    const embeddingModel = String(knowledgeAgentConfig.embeddingModel || '');
    const previousSignatures = { ...(knowledgeAgentConfig.indexSignatures || {}) };
    const previousChunkCounts = { ...(knowledgeAgentConfig.indexChunkCounts || {}) };

    indexStatus.value.isIndexing = true;
    indexStatus.value.error = null;
    indexStatus.value.totalNotes = notes.length;
    indexStatus.value.indexedNotes = 0;
    indexStatus.value.totalChunks = Number(knowledgeAgentConfig.cachedTotalChunks || 0);
    indexStatus.value.progress = 0;
    indexStatus.value.rebuildReason = reason;
    indexStatus.value.skippedNotes = 0;

    try {
      if (fullRebuild) {
        const cleared = await knowledgeAgentService.clearIndex();
        if (!cleared.success) {
          throw new Error(cleared.error || 'Failed to clear index');
        }
      }

      const currentById = new Map<string, NoteIndexPayload>();
      for (const note of notes) {
        currentById.set(note.id, note);
      }

      const staleNoteIds = fullRebuild
        ? []
        : Object.keys(previousSignatures).filter((noteId) => !currentById.has(noteId));
      if (staleNoteIds.length > 0) {
        await runWithConcurrency(
          staleNoteIds.map((noteId) => async () => {
            await knowledgeAgentService.deleteNoteIndex(noteId);
            return noteId;
          }),
          INDEX_CONCURRENCY,
        );
      }

      const nextSignatures: Record<string, string> = {};
      const nextChunkCounts: Record<string, number> = {};
      let cachedTotalChunks = 0;

      for (const note of notes) {
        const signature = buildIndexSignature(note, chunkSize, chunkOverlap, embeddingModel);
        nextSignatures[note.id] = signature;

        const previousSignature = fullRebuild ? undefined : previousSignatures[note.id];
        const previousCount = fullRebuild ? 0 : Number(previousChunkCounts[note.id] || 0);
        if (!fullRebuild && previousSignature === signature) {
          nextChunkCounts[note.id] = previousCount;
          cachedTotalChunks += previousCount;
        }
      }

      const notesToReindex = notes.filter((note) => {
        const signature = nextSignatures[note.id];
        if (fullRebuild) {
          return true;
        }
        return previousSignatures[note.id] !== signature;
      });

      const totalWork = notesToReindex.length;
      const processedCounter = { value: 0 };
      const successCounter = { value: 0 };
      const failCounter = { value: 0 };

      const updateProgress = () => {
        indexStatus.value.indexedNotes = successCounter.value;
        indexStatus.value.skippedNotes = notes.length - totalWork;
        indexStatus.value.progress = totalWork === 0
          ? 100
          : Math.round((processedCounter.value / totalWork) * 100);
      };

      updateProgress();

      await runWithConcurrency(
        notesToReindex.map((note) => async () => {
          try {
            const res = await knowledgeAgentService.indexNote({
              noteId: note.id,
              noteTitle: note.title,
              content: note.content,
              chunkSize,
              chunkOverlap,
            });

            if (!res.success) {
              throw new Error(res.error || 'Failed to index note');
            }

            const chunksIndexed = Number(res.chunksIndexed || 0);
            nextChunkCounts[note.id] = chunksIndexed;
            cachedTotalChunks += chunksIndexed;
            successCounter.value += 1;
          } catch (error) {
            failCounter.value += 1;
            nextSignatures[note.id] = previousSignatures[note.id] || '';
            if (previousChunkCounts[note.id] !== undefined) {
              const fallbackCount = Number(previousChunkCounts[note.id] || 0);
              nextChunkCounts[note.id] = fallbackCount;
              cachedTotalChunks += fallbackCount;
            }
            knowledgeAgentLogger.error(`Failed to index note ${note.id}: ${getErrorMessage(error)}`);
          } finally {
            processedCounter.value += 1;
            updateProgress();
          }
        }),
        INDEX_CONCURRENCY,
      );

      const failedNoteIds = Object.keys(nextSignatures).filter((noteId) => !nextSignatures[noteId]);
      for (const noteId of failedNoteIds) {
        delete nextSignatures[noteId];
        delete nextChunkCounts[noteId];
      }

      const lastIndexedDate = Date.now();
      indexStatus.value.lastIndexedAt = lastIndexedDate;
      indexStatus.value.totalChunks = cachedTotalChunks;
      indexStatus.value.progress = 100;

      await settingsStore.saveSettings({
        knowledgeAgent: {
          ...settingsStore.config.knowledgeAgent,
          lastIndexedAt: lastIndexedDate,
          indexSignatures: nextSignatures,
          indexChunkCounts: nextChunkCounts,
          cachedTotalChunks,
        },
      });

      statusCache.value = {
        timestamp: Date.now(),
        isInitialized: true,
        totalChunks: cachedTotalChunks,
      };

      knowledgeAgentLogger.info(
        `${fullRebuild ? 'Full' : 'Incremental'} index sync finished: changed=${totalWork}, success=${successCounter.value}, failed=${failCounter.value}, skipped=${notes.length - totalWork}`,
      );
    } catch (error) {
      indexStatus.value.error = getErrorMessage(error);
      knowledgeAgentLogger.error(`Failed to rebuild index: ${getErrorMessage(error)}`);
      throw error;
    } finally {
      indexStatus.value.isIndexing = false;
      if (indexStatus.value.error) {
        indexStatus.value.rebuildReason = null;
      }
    }
  };

  const getStatus = async () => {
    try {
      const settingsStore = useSettingsStore();
      const cachedChunks = Number(settingsStore.config.knowledgeAgent.cachedTotalChunks || 0);
      if (cachedChunks >= 0) {
        indexStatus.value.totalChunks = cachedChunks;
      }

      const now = Date.now();
      if (statusCache.value && now - statusCache.value.timestamp < STATUS_CACHE_TTL_MS) {
        return {
          success: true,
          isInitialized: statusCache.value.isInitialized,
          totalChunks: statusCache.value.totalChunks,
          tableName: statusCache.value.tableName,
          error: statusCache.value.error,
        };
      }

      const response = await knowledgeAgentService.getStatus();

      if (response.success) {
        const actualTotalChunks = Number(response.totalChunks || 0);
        indexStatus.value.totalChunks = actualTotalChunks;
        const currentCached = Number(settingsStore.config.knowledgeAgent.cachedTotalChunks || 0);
        if (actualTotalChunks !== currentCached) {
          await settingsStore.updateKnowledgeAgentSetting('cachedTotalChunks', actualTotalChunks);
        }
        statusCache.value = {
          timestamp: now,
          isInitialized: Boolean(response.isInitialized),
          totalChunks: actualTotalChunks,
          tableName: response.tableName,
          error: response.error,
        };
        knowledgeAgentLogger.info(`Status: ${response.totalChunks} chunks indexed`);
      }

      return response;
    } catch (error) {
      knowledgeAgentLogger.error(`Failed to get status: ${getErrorMessage(error)}`);
      throw error;
    }
  };

  const deleteNoteIndex = async (noteId: string) => {
    try {
      const result = await knowledgeAgentService.deleteNoteIndex(noteId);

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete note index');
      }

      const settingsStore = useSettingsStore();
      const knowledgeAgentConfig = settingsStore.config.knowledgeAgent;
      const nextSignatures = { ...(knowledgeAgentConfig.indexSignatures || {}) };
      const nextChunkCounts = { ...(knowledgeAgentConfig.indexChunkCounts || {}) };
      const removedChunks = Number(nextChunkCounts[noteId] || 0);
      delete nextSignatures[noteId];
      delete nextChunkCounts[noteId];
      const nextTotalChunks = Math.max(0, Number(knowledgeAgentConfig.cachedTotalChunks || 0) - removedChunks);

      await settingsStore.saveSettings({
        knowledgeAgent: {
          ...knowledgeAgentConfig,
          indexSignatures: nextSignatures,
          indexChunkCounts: nextChunkCounts,
          cachedTotalChunks: nextTotalChunks,
        },
      });

      indexStatus.value.totalChunks = nextTotalChunks;
      statusCache.value = {
        timestamp: Date.now(),
        isInitialized: true,
        totalChunks: nextTotalChunks,
      };

      knowledgeAgentLogger.info(`Deleted index for note: ${noteId}`);
    } catch (error) {
      knowledgeAgentLogger.error(`Failed to delete note index ${noteId}: ${getErrorMessage(error)}`);
      throw error;
    }
  };

  const clearIndex = async () => {
    try {
      const result = await knowledgeAgentService.clearIndex();

      if (!result.success) {
        throw new Error(result.error || 'Failed to clear index');
      }

      indexStatus.value.totalChunks = 0;
      indexStatus.value.indexedNotes = 0;
      indexStatus.value.lastIndexedAt = null;
      indexStatus.value.progress = 0;
      indexStatus.value.skippedNotes = 0;

      const settingsStore = useSettingsStore();
      await settingsStore.saveSettings({
        knowledgeAgent: {
          ...settingsStore.config.knowledgeAgent,
          lastIndexedAt: indexStatus.value.lastIndexedAt,
          indexSignatures: {},
          indexChunkCounts: {},
          cachedTotalChunks: 0,
        },
      });

      statusCache.value = {
        timestamp: Date.now(),
        isInitialized: true,
        totalChunks: 0,
      };

      knowledgeAgentLogger.info('Cleared all index data');
    } catch (error) {
      knowledgeAgentLogger.error(`Failed to clear index: ${getErrorMessage(error)}`);
      throw error;
    }
  };

  return {
    indexStatus,
    indexNote,
    rebuildIndex,
    getStatus,
    deleteNoteIndex,
    clearIndex,
  };
});

