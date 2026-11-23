import { onUnmounted, watch, type WatchStopHandle } from 'vue';
import { isScheduledBackupDue } from '@shared/scheduled-backup.constants';
import { createLogger } from '@renderer/features/logger';
import { i18n } from '@renderer/features/i18n';
import { getErrorMessage } from '@shared/utils/error.utils';
import { useWorkspaceStore } from '@renderer/features/workspace/store/workspace.store';
import { settingsService } from '../services/settings.service';
import { useSettingsStore } from '../store/settings.store';

const RETRY_DELAY_MS = 5 * 60 * 1000;
const MAX_SCHEDULE_DELAY_MS = 24 * 60 * 60 * 1000;
const logger = createLogger('ScheduledBackupLifecycle');

export function useScheduledBackupLifecycle(): {
  setupScheduledBackup: () => void;
} {
  const settingsStore = useSettingsStore();
  const workspaceStore = useWorkspaceStore();
  let backupTimer: number | null = null;
  let retryAfter = 0;
  let activeBackup: Promise<boolean> | null = null;
  let stopConfigWatcher: WatchStopHandle | null = null;

  const clearBackupTimer = (): void => {
    if (backupTimer !== null) {
      window.clearTimeout(backupTimer);
      backupTimer = null;
    }
  };

  const runBackupIfDue = async (): Promise<boolean> => {
    if (activeBackup) {
      return await activeBackup;
    }

    activeBackup = (async (): Promise<boolean> => {
      const scheduledBackup = { ...settingsStore.config.noteStorage.scheduledBackup };
      if (!isScheduledBackupDue(scheduledBackup)) {
        return true;
      }

      settingsStore.scheduledBackupRunning = true;
      try {
        await workspaceStore.forceFlushAutoSave();
        const result = await settingsService.createScheduledBackup({
          directoryPath: scheduledBackup.directoryPath,
          retentionCount: scheduledBackup.retentionCount,
        });

        if (
          result.success
          && settingsStore.config.noteStorage.scheduledBackup.directoryPath === scheduledBackup.directoryPath
        ) {
          await settingsStore.noteStorage.updateScheduledBackup({
            lastBackupAt: result.backedUpAt,
          });
        }
        if (!result.success) throw new Error(i18n.global.t('scheduledBackup.failed'));
        settingsStore.scheduledBackupError = null;
        return true;
      } catch (error: unknown) {
        settingsStore.scheduledBackupError = getErrorMessage(error);
        logger.error(`Scheduled backup failed: ${getErrorMessage(error)}`);
        return false;
      } finally {
        settingsStore.scheduledBackupRunning = false;
      }
    })();

    try {
      return await activeBackup;
    } finally {
      activeBackup = null;
    }
  };

  const scheduleNextBackup = (): void => {
    clearBackupTimer();
    const scheduledBackup = settingsStore.config.noteStorage.scheduledBackup;
    if (!scheduledBackup.enabled || !scheduledBackup.directoryPath.trim()) {
      return;
    }

    const now = Date.now();
    const dueAt = scheduledBackup.lastBackupAt === null
      ? now
      : scheduledBackup.lastBackupAt + scheduledBackup.intervalHours * 60 * 60 * 1000;
    const delay = Math.min(
      MAX_SCHEDULE_DELAY_MS,
      Math.max(0, dueAt - now, retryAfter - now),
    );

    backupTimer = window.setTimeout(() => {
      backupTimer = null;
      void runBackupIfDue().then((success) => {
        retryAfter = success ? 0 : Date.now() + RETRY_DELAY_MS;
        scheduleNextBackup();
      });
    }, delay);
  };

  const setupScheduledBackup = (): void => {
    stopConfigWatcher?.();
    stopConfigWatcher = watch(
      () => {
        const scheduledBackup = settingsStore.config.noteStorage.scheduledBackup;
        return [
          scheduledBackup.enabled,
          scheduledBackup.directoryPath,
          scheduledBackup.intervalHours,
          scheduledBackup.retentionCount,
          settingsStore.scheduledBackupRetryRequest,
        ] as const;
      },
      () => {
        retryAfter = 0;
        scheduleNextBackup();
      },
      { immediate: true },
    );
  };

  onUnmounted(() => {
    clearBackupTimer();
    stopConfigWatcher?.();
  });

  return { setupScheduledBackup };
}
