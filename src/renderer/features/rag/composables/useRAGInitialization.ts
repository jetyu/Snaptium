import { watch, type WatchStopHandle } from 'vue';
import { useSettingsStore } from '@renderer/features/settings/store/settings.store';
import { useWorkspaceStore } from '@renderer/features/workspace/store/workspace.store';
import { ragService } from '../services/rag.service';
import { useRAGIndex } from './useRAGIndex';
import { createLogger } from '@renderer/features/logger';

const ragInitLogger = createLogger('useRAGInitialization');

export function useRAGInitialization() {
  const settingsStore = useSettingsStore();
  const workspaceStore = useWorkspaceStore();
  const { rebuildIndex, indexNote } = useRAGIndex();
  let stopAutoIndexOnSaveWatcher: WatchStopHandle | null = null;
  let stopAutoIndexSettingWatcher: WatchStopHandle | null = null;

  const initializeRAG = async () => {
    const ragConfig = (settingsStore.config as any).rag;

    if (!ragConfig?.enabled) {
      ragInitLogger.info('RAG is disabled, skipping initialization');
      return;
    }

    try {
      ragInitLogger.info('Initializing RAG service...');
      // ragService.initialize reads settings internally
      const result = await ragService.initialize();

      if (result.success) {
        ragInitLogger.info('RAG service initialized successfully');

        if (ragConfig.autoIndex) {
          await autoIndexAllNotes();
        }
      } else {
        ragInitLogger.error(`RAG initialization failed: ${result.error}`);
      }
    } catch (error: any) {
      ragInitLogger.error(`RAG initialization error: ${error.message}`);
    }
  };

  const autoIndexAllNotes = async () => {
    try {
      ragInitLogger.info('Starting auto-indexing...');

      const notes = workspaceStore.notes.map(note => ({
        id: note.id,
        title: note.title,
        content: note.content,
      }));

      if (notes.length === 0) {
        ragInitLogger.info('No notes to index');
        return;
      }

      await rebuildIndex(notes);
      ragInitLogger.info(`Auto-indexed ${notes.length} notes`);
    } catch (error: any) {
      ragInitLogger.error(`Auto-indexing failed: ${error.message}`);
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
            ragInitLogger.info(`Auto-indexing note on save: ${savedNoteMeta.noteId}`);
            // Find note content in store
            const note = workspaceStore.notes.find(n => n.id === savedNoteMeta.noteId);
            if (!note) return;

            await indexNote(
              savedNoteMeta.noteId,
              savedNoteMeta.title,
              note.content
            );
          } catch (error: any) {
            ragInitLogger.error(`Failed to auto-index note: ${error.message}`);
          }
        }
      );
    };

    stopAutoIndexSettingWatcher?.();
    stopAutoIndexSettingWatcher = watch(
      () => [(settingsStore.config as any).rag?.enabled, (settingsStore.config as any).rag?.indexOnSave] as const,
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

  watch(
    () => (settingsStore.config as any).rag?.enabled,
    async (enabled) => {
      if (enabled) {
        await initializeRAG();
      }
    }
  );

  // When config changes, re-initialize
  watch(
    () => [
      (settingsStore.config as any).rag?.embeddingSourceId,
      (settingsStore.config as any).rag?.embeddingModel,
    ] as const,
    async () => {
      await initializeRAG();
    }
  );

  return {
    initializeRAG,
    autoIndexAllNotes,
    setupAutoIndexOnSave,
  };
}
