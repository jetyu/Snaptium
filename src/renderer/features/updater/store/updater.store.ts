import { defineStore } from 'pinia';
import { ref } from 'vue';
import i18n from '@renderer/features/i18n/services/i18n.service';
import {
  updaterService,
  type ErrorInfo,
  type ProgressInfo,
  type UpdateInfo,
  type UpdaterConfig,
} from '../services/updater.service';

type UpdaterNotificationState = 'available' | 'not-available' | 'error';

function translate(key: string): string {
  return i18n.global.t(key) as string;
}

function getErrorMessage(err: Error | { message?: string } | string | null | undefined, fallback: string): string {
  if (err instanceof Error && err.message) {
    return err.message;
  }

  if (typeof err === 'string' && err.trim()) {
    return err;
  }

  if (typeof err === 'object' && err && typeof err.message === 'string' && err.message.trim()) {
    return err.message;
  }

  return fallback;
}

export const useUpdaterStore = defineStore('updater', () => {
  const currentVersion = ref('0.0.0');
  const isChecking = ref(false);
  const isDownloading = ref(false);
  const updateAvailable = ref(false);
  const updateInfo = ref<UpdateInfo | null>(null);
  const downloadProgress = ref<ProgressInfo>({
    percent: 0,
    bytesPerSecond: 0,
    transferred: 0,
    total: 0,
  });
  const error = ref<ErrorInfo | null>(null);
  const showNotification = ref(false);
  const showProgressDialog = ref(false);
  const showInstallDialog = ref(false);
  const notificationState = ref<UpdaterNotificationState>('available');
  const isSilentCheck = ref(true);

  let cleanupListeners: (() => void) | null = null;
  let removeMenuListener: (() => void) | null = null;
  let initialized = false;

  async function getCurrentVersion(): Promise<void> {
    try {
      currentVersion.value = await updaterService.getVersion();
    } catch (err) {
      console.error('Failed to get version:', err);
    }
  }

  function clearDiscoveredUpdate(): void {
    updateAvailable.value = false;
    updateInfo.value = null;
    error.value = null;
    showNotification.value = false;
  }

  function handleUpdateChecking(): void {
    isChecking.value = true;
  }

  function handleUpdateAvailable(info: UpdateInfo): void {
    isChecking.value = false;
    updateAvailable.value = true;
    updateInfo.value = info;
    notificationState.value = 'available';
    showNotification.value = true;
  }

  function handleUpdateNotAvailable(): void {
    isChecking.value = false;
    updateAvailable.value = false;
    updateInfo.value = null;
    notificationState.value = 'not-available';
    if (!isSilentCheck.value) {
      showNotification.value = true;
    }
  }

  function handleDownloadProgress(progress: ProgressInfo): void {
    downloadProgress.value = progress;
  }

  function handleUpdateDownloaded(info: UpdateInfo): void {
    isDownloading.value = false;
    showProgressDialog.value = false;
    updateAvailable.value = true;
    updateInfo.value = info;
    showInstallDialog.value = true;
  }

  function handleUpdateError(errorInfo: ErrorInfo): void {
    isChecking.value = false;
    isDownloading.value = false;
    error.value = errorInfo;

    if (!showProgressDialog.value) {
      notificationState.value = 'error';
      showNotification.value = true;
    }
  }

  async function checkForUpdates(silent = false): Promise<void> {
    if (isChecking.value) return;

    isSilentCheck.value = silent;
    isChecking.value = true;
    error.value = null;

    try {
      await updaterService.check(silent);
    } catch (err) {
      error.value = {
        message: getErrorMessage(err as Error | { message?: string }, translate('updater.checkFailed')),
        code: 'CHECK_FAILED',
      };
      if (!silent) {
        notificationState.value = 'error';
        showNotification.value = true;
      }
      isChecking.value = false;
    }
  }

  async function downloadUpdate(): Promise<void> {
    if (isDownloading.value) return;

    isDownloading.value = true;
    showNotification.value = false;
    showProgressDialog.value = true;
    error.value = null;

    try {
      await updaterService.download();
    } catch (err) {
      error.value = {
        message: getErrorMessage(err as Error | { message?: string }, translate('updater.downloadFailed')),
        code: 'DOWNLOAD_FAILED',
      };
      isDownloading.value = false;
    }
  }

  async function installUpdate(): Promise<void> {
    try {
      await updaterService.install();
    } catch (err) {
      console.error('Failed to install update:', err);
    }
  }

  async function updateConfig(config: UpdaterConfig): Promise<void> {
    try {
      await updaterService.updateConfig(config);
    } catch (err) {
      console.error('Failed to update config:', err);
    }
  }

  function initialize(): void {
    if (initialized) {
      return;
    }

    initialized = true;
    void getCurrentVersion();
    cleanupListeners = updaterService.subscribe({
      onChecking: handleUpdateChecking,
      onAvailable: handleUpdateAvailable,
      onNotAvailable: handleUpdateNotAvailable,
      onDownloadProgress: handleDownloadProgress,
      onDownloaded: handleUpdateDownloaded,
      onError: handleUpdateError,
    });
    removeMenuListener = updaterService.onCheckForUpdates(() => {
      void checkForUpdates(false);
    });
  }

  function dispose(): void {
    cleanupListeners?.();
    removeMenuListener?.();
    cleanupListeners = null;
    removeMenuListener = null;
    initialized = false;
  }

  return {
    currentVersion,
    isChecking,
    isDownloading,
    updateAvailable,
    updateInfo,
    downloadProgress,
    error,
    showNotification,
    showProgressDialog,
    showInstallDialog,
    notificationState,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    getCurrentVersion,
    updateConfig,
    clearDiscoveredUpdate,
    initialize,
    dispose,
  };
});
