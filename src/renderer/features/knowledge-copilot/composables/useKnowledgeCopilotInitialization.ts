import { watch, type WatchStopHandle } from 'vue';
import { useSettingsStore } from '@renderer/features/settings/store/settings.store';
import { useWorkspaceStore } from '@renderer/features/workspace/store/workspace.store';
import { knowledgeCopilotService } from '../services/knowledge-copilot.service';
import { useKnowledgeCopilotIndex } from './useKnowledgeCopilotIndex';
import { createLogger } from '@renderer/features/logger';
import { getErrorMessage } from '@shared/utils/error.utils';

const knowledgeCopilotInitLogger = createLogger('useKnowledgeCopilotInitialization');

export function useKnowledgeCopilotInitialization() {
  const settingsStore = useSettingsStore();
  const workspaceStore = useWorkspaceStore();
  const { rebuildIndex, indexNote } = useKnowledgeCopilotIndex();
  let stopAutoIndexOnSaveWatcher: WatchStopHandle | null = null;
  let stopAutoIndexSettingWatcher: WatchStopHandle | null = null;
  let stopVfsIndexWatcher: WatchStopHandle | null = null;
  let indexedNoteSnapshots = new Map<string, string>();
  let indexQueue = Promise.resolve();

  const initializeKnowledgeCopilot = async (options?: { skipAutoIndex?: boolean }) => {
    const knowledgeCopilotConfig = settingsStore.config.knowledgeCopilot;

    if (!knowledgeCopilotConfig?.enabled) {
      knowledgeCopilotInitLogger.info('KnowledgeCopilot is disabled, skipping initialization');
      return;
    }

    try {
      knowledgeCopilotInitLogger.info('Initializing KnowledgeCopilot service...');
      // knowledgeCopilotService.initialize reads settings internally
      const result = await knowledgeCopilotService.initialize();

      if (result.success) {
        knowledgeCopilotInitLogger.info('KnowledgeCopilot service initialized successfully');

        if (knowledgeCopilotConfig.autoIndex && !options?.skipAutoIndex) {
          await autoIndexAllNotes('auto-index');
        }
      } else {
        knowledgeCopilotInitLogger.error(`KnowledgeCopilot initialization failed: ${result.error}`);
      }
    } catch (error) {
      knowledgeCopilotInitLogger.error(`KnowledgeCopilot initialization error: ${getErrorMessage(error)}`);
    }
  };

  const autoIndexAllNotes = async (reason: 'auto-index' = 'auto-index') => {
    try {
      knowledgeCopilotInitLogger.info('Starting incremental index sync...');

      const notes = workspaceStore.notes.map(note => ({
        id: note.id,
        title: note.title,
        content: note.content,
      }));

      if (notes.length === 0) {
        knowledgeCopilotInitLogger.info('No notes to index');
        return;
      }

      await rebuildIndex(notes, reason);
      knowledgeCopilotInitLogger.info(`Incremental index sync completed for ${notes.length} notes`);
    } catch (error) {
      knowledgeCopilotInitLogger.error(`Auto-indexing failed: ${getErrorMessage(error)}`);
    }
  };


  const setupAutoIndexOnSave = () => {
    const teardownAutoIndexOnSave = () => {
      stopAutoIndexOnSaveWatcher?.();
      stopAutoIndexOnSaveWatcher = null;
    };

    const installAutoIndexOnSave = () => {
      if (stopAutoIndexOnSaveWatcher) {
        return;
      }

      stopAutoIndexOnSaveWatcher = watch(
        () => workspaceStore.lastSavedNoteMeta,
        async (savedNoteMeta, previousMeta) => {
          if (!savedNoteMeta || savedNoteMeta.savedAt === previousMeta?.savedAt) {
            return;
          }

          try {
            knowledgeCopilotInitLogger.info(`Auto-indexing note on save: ${savedNoteMeta.noteId}`);
            // Find note content in store
            const note = workspaceStore.notes.find(n => n.id === savedNoteMeta.noteId);
            if (!note) return;

            await indexNote(
              savedNoteMeta.noteId,
              savedNoteMeta.title,
              note.content
            );
          } catch (error) {
            knowledgeCopilotInitLogger.error(`Failed to auto-index note: ${getErrorMessage(error)}`);
          }
        }
      );
    };

    stopAutoIndexSettingWatcher?.();
    stopAutoIndexSettingWatcher = watch(
      () => [settingsStore.config.knowledgeCopilot?.enabled, settingsStore.config.knowledgeCopilot?.indexOnSave] as const,
      ([enabled, indexOnSave]) => {
        if (enabled && indexOnSave) {
          installAutoIndexOnSave();
          return;
        }

        teardownAutoIndexOnSave();
      },
      { immediate: true }
    );
  };

  const setupVfsAutoIndex = () => {
    stopVfsIndexWatcher?.();
    indexedNoteSnapshots = new Map(workspaceStore.notes.map((note) => [
      note.id,
      JSON.stringify([note.title, note.content, note.parentId]),
    ]));

    stopVfsIndexWatcher = watch(
      () => workspaceStore.notes.map((note) => ({
        id: note.id,
        title: note.title,
        content: note.content,
        parentId: note.parentId,
      })),
      (notes) => {
        const config = settingsStore.config.knowledgeCopilot;
        if (!config.enabled || !config.autoIndex) return;

        const nextSnapshots = new Map(notes.map((note) => [
          note.id,
          JSON.stringify([note.title, note.content, note.parentId]),
        ]));
        const removedNoteIds = [...indexedNoteSnapshots.keys()].filter((noteId) => !nextSnapshots.has(noteId));
        const changedNotes = notes.filter((note) => indexedNoteSnapshots.get(note.id) !== nextSnapshots.get(note.id));
        indexedNoteSnapshots = nextSnapshots;

        indexQueue = indexQueue.then(async () => {
          for (const noteId of removedNoteIds) {
            await knowledgeCopilotService.deleteNoteIndex(noteId);
          }
          for (const note of changedNotes) {
            await indexNote(note.id, note.title, note.content);
          }
        }).catch((error) => {
          knowledgeCopilotInitLogger.error(`VFS auto-index queue failed: ${getErrorMessage(error)}`);
        });
      },
      { deep: true },
    );
  };

  watch(
    () => (settingsStore.config.knowledgeCopilot?.enabled),
    async (enabled) => {
      if (enabled) {
        await initializeKnowledgeCopilot();
      }
    }
  );

  // When config changes, re-initialize
  watch(
    () => [
      (settingsStore.config.knowledgeCopilot?.embeddingSourceId),
      (settingsStore.config.knowledgeCopilot?.embeddingModel),
    ] as const,
    async (current, previous) => {
      if (!previous || current[0] === previous[0] && current[1] === previous[1]) {
        return;
      }

      const knowledgeCopilotConfig = settingsStore.config.knowledgeCopilot;
      if (!knowledgeCopilotConfig?.enabled || !current[0] || !current[1]) {
        return;
      }

      await initializeKnowledgeCopilot({ skipAutoIndex: true });
      knowledgeCopilotInitLogger.info('Embedding model changed. Old index not automatically rebuilt as per user preference.');
    }
  );

  return {
    initializeKnowledgeCopilot,
    autoIndexAllNotes,
    setupAutoIndexOnSave,
    setupVfsAutoIndex,
  };
}

