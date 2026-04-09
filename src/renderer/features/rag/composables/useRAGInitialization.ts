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
  const resolveEmbeddingModel = (aiModel: string) =>
    settingsStore.config.rag.embeddingModel || aiModel;

  const initializeRAG = async () => {
    const ragConfig = settingsStore.config.rag;

    if (!ragConfig.enabled) {
      ragInitLogger.info('RAG is disabled, skipping initialization');
      return;
    }

    if (!ragConfig.embeddingSourceId) {
      ragInitLogger.warn('RAG configuration incomplete, skipping initialization');
      return;
    }

    try {
      const embeddingSource = settingsStore.config.aiSources.find(
        source => source.id === ragConfig.embeddingSourceId
      );

      if (!embeddingSource) {
        ragInitLogger.error('Embedding source not found');
        return;
      }

      if (!embeddingSource.aiModel) {
        ragInitLogger.error('Embedding source has no default model');
        return;
      }

      const workspaceRoot = settingsStore.config.noteSavePath;
      if (!workspaceRoot) {
        ragInitLogger.error('Workspace root not configured');
        return;
      }

      ragInitLogger.info('Initializing RAG service...');
      const result = await ragService.initialize({
        workspaceRoot,
        embeddingConfig: {
          endpoint: embeddingSource.endpoint,
          apiKey: embeddingSource.apiKey,
          model: resolveEmbeddingModel(embeddingSource.aiModel),
        },
      });

      if (result.success) {
        ragInitLogger.info('RAG service initialized successfully');

        if (ragConfig.autoIndex) {
          await autoIndexAllNotes();
        }
      } else {
        ragInitLogger.error(`RAG initialization failed: ${result.error}`);
      }
    } catch (error) {
      ragInitLogger.error(`RAG initialization error: ${error}`);
    }
  };

  const autoIndexAllNotes = async () => {
    try {
      ragInitLogger.info('Starting auto-indexing...');

      const notes = workspaceStore.notes.map(note => ({
        id: note.id,
        title: note.title,
        path: `Database/objects/${note.contentId}.md`,
      }));

      if (notes.length === 0) {
        ragInitLogger.info('No notes to index');
        return;
      }

      await rebuildIndex(notes);
      ragInitLogger.info(`Auto-indexed ${notes.length} notes`);
    } catch (error) {
      ragInitLogger.error(`Auto-indexing failed: ${error}`);
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
            await indexNote(
              savedNoteMeta.noteId,
              savedNoteMeta.title,
              `Database/objects/${savedNoteMeta.contentId}.md`
            );
          } catch (error) {
            ragInitLogger.error(`Failed to auto-index note: ${error}`);
          }
        }
      );
    };

    stopAutoIndexSettingWatcher?.();
    stopAutoIndexSettingWatcher = watch(
      () => [settingsStore.config.rag.enabled, settingsStore.config.rag.indexOnSave] as const,
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


  const updateEmbeddingConfig = async () => {
    const ragConfig = settingsStore.config.rag;

    if (!ragConfig.enabled || !ragConfig.embeddingSourceId) {
      return;
    }

    const embeddingSource = settingsStore.config.aiSources.find(
      source => source.id === ragConfig.embeddingSourceId
    );

    if (!embeddingSource || !embeddingSource.aiModel) {
      return;
    }

    try {
      await ragService.updateConfig({
        endpoint: embeddingSource.endpoint,
        apiKey: embeddingSource.apiKey,
        model: resolveEmbeddingModel(embeddingSource.aiModel),
      });
      ragInitLogger.info('Embedding config updated');
    } catch (error) {
      ragInitLogger.error(`Failed to update embedding config: ${error}`);
    }
  };

  watch(
    () => settingsStore.config.rag.enabled,
    async (enabled) => {
      if (enabled) {
        await initializeRAG();
      }
    }
  );

  watch(
    () => [
      settingsStore.config.rag.embeddingSourceId,
      settingsStore.config.rag.embeddingModel,
    ] as const,
    async () => {
      await updateEmbeddingConfig();
    }
  );

  return {
    initializeRAG,
    autoIndexAllNotes,
    setupAutoIndexOnSave,
  };
}
