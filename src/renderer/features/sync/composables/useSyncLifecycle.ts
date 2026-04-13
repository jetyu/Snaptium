import { onUnmounted, watch, type WatchStopHandle } from 'vue';
import { useSettingsStore } from '@renderer/features/settings/store/settings.store';
import { useWorkspaceStore } from '@renderer/features/workspace/store/workspace.store';
import { SYNC_TRIGGERS } from '../constants/sync.constants';
import { syncService } from '../services/sync.service';
import { useSyncStore } from '../store/sync.store';

export function useSyncLifecycle() {
  const settingsStore = useSettingsStore();
  const workspaceStore = useWorkspaceStore();
  const syncStore = useSyncStore();
  let syncIntervalTimer: number | null = null;
  let stopConfigWatcher: WatchStopHandle | null = null;
  let stopAutoSyncOnSaveWatcher: WatchStopHandle | null = null;

  const clearSyncInterval = () => {
    if (syncIntervalTimer !== null) {
      window.clearInterval(syncIntervalTimer);
      syncIntervalTimer = null;
    }
  };

  const installSyncInterval = () => {
    clearSyncInterval();
    const syncConfig = settingsStore.config.sync;
    if (!syncConfig.enabled || syncConfig.intervalMinutes <= 0 || !syncService.isConfigReady(syncConfig)) {
      return;
    }

    syncIntervalTimer = window.setInterval(() => {
      void workspaceStore.forceFlushAutoSave().then(() => {
        return syncStore.runSync(settingsStore.config.sync, SYNC_TRIGGERS.TIMER);
      });
    }, syncConfig.intervalMinutes * 60 * 1000);
  };

  const initializeSync = async () => {
    await syncStore.initialize(settingsStore.config.sync);
  };

  const setupAutoSync = () => {
    stopConfigWatcher?.();
    stopAutoSyncOnSaveWatcher?.();

    stopConfigWatcher = watch(
      () => [
        settingsStore.config.sync.enabled,
        settingsStore.config.sync.intervalMinutes,
        settingsStore.config.sync.provider,
        settingsStore.config.sync.remotePath,
        settingsStore.config.noteSavePath,
      ] as const,
      async () => {
        await syncStore.initialize(settingsStore.config.sync);
        installSyncInterval();
      },
      { immediate: true }
    );

    stopAutoSyncOnSaveWatcher = watch(
      () => workspaceStore.lastSavedNoteMeta,
      async (savedNoteMeta, previousMeta) => {
        if (!savedNoteMeta || savedNoteMeta.savedAt === previousMeta?.savedAt) {
          return;
        }

        const syncConfig = settingsStore.config.sync;
        if (!syncConfig.enabled || !syncConfig.autoSyncOnSave || !syncService.isConfigReady(syncConfig)) {
          return;
        }

        await syncStore.runSync(syncConfig, SYNC_TRIGGERS.SAVE);
      }
    );
  };

  onUnmounted(() => {
    clearSyncInterval();
    stopConfigWatcher?.();
    stopAutoSyncOnSaveWatcher?.();
  });

  return {
    initializeSync,
    setupAutoSync,
  };
}