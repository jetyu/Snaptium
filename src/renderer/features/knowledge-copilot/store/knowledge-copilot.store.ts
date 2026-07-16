/**
 * KnowledgeCopilot Store
 *
 * Manages KnowledgeCopilot indexing/search state and orchestration-level cache metadata.
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { knowledgeCopilotService } from '../services/knowledge-copilot.service';
import { createLogger } from '@renderer/features/logger';
import { getErrorMessage } from '@shared/utils/error.utils';
import { useSettingsStore } from '../../settings/store/settings.store';

const knowledgeCopilotLogger = createLogger('KnowledgeCopilotStore');

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

export const useKnowledgeCopilotStore = defineStore('knowledgeCopilot', () => {
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
      const result = await knowledgeCopilotService.indexNote({
        noteId,
        noteTitle,
        content,
        chunkSize,
        chunkOverlap,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to index note');
      }

      knowledgeCopilotLogger.info(`Indexed note: ${noteId}, chunks: ${result.chunksIndexed}`);
      const lastIndexedDate = Date.now();
      indexStatus.value.lastIndexedAt = lastIndexedDate;

      const settingsStore = useSettingsStore();
      const knowledgeCopilotConfig = settingsStore.config.knowledgeCopilot;
      const previousChunkCounts = knowledgeCopilotConfig.indexChunkCounts || {};
      const previousSignatures = knowledgeCopilotConfig.indexSignatures || {};
      const previousCount = Number(previousChunkCounts[noteId] || 0);
      const nextCount = Number(result.chunksIndexed || 0);
      const nextTotalChunks = Math.max(0, Number(knowledgeCopilotConfig.cachedTotalChunks || 0) - previousCount + nextCount);
      const nextSignature = buildIndexSignature(
        { id: noteId, title: noteTitle, content },
        chunkSize,
        chunkOverlap,
        String(knowledgeCopilotConfig.embeddingModel || ''),
      );

      await settingsStore.saveSettings({
        knowledgeCopilot: {
          ...knowledgeCopilotConfig,
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
      knowledgeCopilotLogger.error(`Failed to index note ${noteId}: ${getErrorMessage(error)}`);
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
    const knowledgeCopilotConfig = settingsStore.config.knowledgeCopilot;
    const embeddingModel = String(knowledgeCopilotConfig.embeddingModel || '');
    const previousSignatures = { ...(knowledgeCopilotConfig.indexSignatures || {}) };
    const previousChunkCounts = { ...(knowledgeCopilotConfig.indexChunkCounts || {}) };

    indexStatus.value.isIndexing = true;
    indexStatus.value.error = null;
    indexStatus.value.totalNotes = notes.length;
    indexStatus.value.indexedNotes = 0;
    indexStatus.value.totalChunks = Number(knowledgeCopilotConfig.cachedTotalChunks || 0);
    indexStatus.value.progress = 0;
    indexStatus.value.rebuildReason = reason;
    indexStatus.value.skippedNotes = 0;

    try {
      if (fullRebuild) {
        const cleared = await knowledgeCopilotService.clearIndex();
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
            await knowledgeCopilotService.deleteNoteIndex(noteId);
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
            const res = await knowledgeCopilotService.indexNote({
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
            knowledgeCopilotLogger.error(`Failed to index note ${note.id}: ${getErrorMessage(error)}`);
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
        knowledgeCopilot: {
          ...settingsStore.config.knowledgeCopilot,
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

      knowledgeCopilotLogger.info(
        `${fullRebuild ? 'Full' : 'Incremental'} index sync finished: changed=${totalWork}, success=${successCounter.value}, failed=${failCounter.value}, skipped=${notes.length - totalWork}`,
      );
    } catch (error) {
      indexStatus.value.error = getErrorMessage(error);
      knowledgeCopilotLogger.error(`Failed to rebuild index: ${getErrorMessage(error)}`);
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
      const cachedChunks = Number(settingsStore.config.knowledgeCopilot.cachedTotalChunks || 0);
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

      const response = await knowledgeCopilotService.getStatus();

      if (response.success) {
        const actualTotalChunks = Number(response.totalChunks || 0);
        indexStatus.value.totalChunks = actualTotalChunks;
        const currentCached = Number(settingsStore.config.knowledgeCopilot.cachedTotalChunks || 0);
        if (actualTotalChunks !== currentCached) {
          await settingsStore.updateKnowledgeCopilotSetting('cachedTotalChunks', actualTotalChunks);
        }
        statusCache.value = {
          timestamp: now,
          isInitialized: Boolean(response.isInitialized),
          totalChunks: actualTotalChunks,
          tableName: response.tableName,
          error: response.error,
        };
        knowledgeCopilotLogger.info(`Status: ${response.totalChunks} chunks indexed`);
      }

      return response;
    } catch (error) {
      knowledgeCopilotLogger.error(`Failed to get status: ${getErrorMessage(error)}`);
      throw error;
    }
  };

  const deleteNoteIndex = async (noteId: string) => {
    try {
      const result = await knowledgeCopilotService.deleteNoteIndex(noteId);

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete note index');
      }

      const settingsStore = useSettingsStore();
      const knowledgeCopilotConfig = settingsStore.config.knowledgeCopilot;
      const nextSignatures = { ...(knowledgeCopilotConfig.indexSignatures || {}) };
      const nextChunkCounts = { ...(knowledgeCopilotConfig.indexChunkCounts || {}) };
      const removedChunks = Number(nextChunkCounts[noteId] || 0);
      delete nextSignatures[noteId];
      delete nextChunkCounts[noteId];
      const nextTotalChunks = Math.max(0, Number(knowledgeCopilotConfig.cachedTotalChunks || 0) - removedChunks);

      await settingsStore.saveSettings({
        knowledgeCopilot: {
          ...knowledgeCopilotConfig,
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

      knowledgeCopilotLogger.info(`Deleted index for note: ${noteId}`);
    } catch (error) {
      knowledgeCopilotLogger.error(`Failed to delete note index ${noteId}: ${getErrorMessage(error)}`);
      throw error;
    }
  };

  const clearIndex = async () => {
    try {
      const result = await knowledgeCopilotService.clearIndex();

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
        knowledgeCopilot: {
          ...settingsStore.config.knowledgeCopilot,
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

      knowledgeCopilotLogger.info('Cleared all index data');
    } catch (error) {
      knowledgeCopilotLogger.error(`Failed to clear index: ${getErrorMessage(error)}`);
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

