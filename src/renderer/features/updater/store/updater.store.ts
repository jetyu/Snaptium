import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import i18n from '@renderer/features/i18n/services/i18n.service';
import {
  updaterService,
  type ErrorInfo,
  type ProgressInfo,
  type UpdateInfo,
  type UpdaterConfig,
} from '../services/updater.service';

export type UpdatePanelState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready-to-install'
  | 'error'
  | 'up-to-date';

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
  const isUpdateDownloaded = ref(false);
  const updateInfo = ref<UpdateInfo | null>(null);
  const downloadProgress = ref<ProgressInfo>({
    percent: 0,
    bytesPerSecond: 0,
    transferred: 0,
    total: 0,
  });
  const error = ref<ErrorInfo | null>(null);
  const availableActionsDismissed = ref(false);
  const installActionsDismissed = ref(false);
  const showNoUpdateResult = ref(false);
  const isSilentCheck = ref(true);

  let cleanupListeners: (() => void) | null = null;
  let initialized = false;

  const showAvailableUpdateActions = computed(() =>
    updateAvailable.value &&
    Boolean(updateInfo.value) &&
    !isChecking.value &&
    !isDownloading.value &&
    !isUpdateDownloaded.value &&
    !availableActionsDismissed.value &&
    !error.value
  );

  const showInstallActions = computed(() =>
    isUpdateDownloaded.value &&
    Boolean(updateInfo.value) &&
    !isChecking.value &&
    !installActionsDismissed.value &&
    !error.value
  );

  const updatePanelState = computed<UpdatePanelState>(() => {
    if (error.value) {
      return 'error';
    }

    if (isDownloading.value) {
      return 'downloading';
    }

    if (isChecking.value) {
      return 'checking';
    }

    if (isUpdateDownloaded.value) {
      return 'ready-to-install';
    }

    if (updateAvailable.value && updateInfo.value) {
      return 'available';
    }

    if (showNoUpdateResult.value) {
      return 'up-to-date';
    }

    return 'idle';
  });

  async function getCurrentVersion(): Promise<void> {
    try {
      currentVersion.value = await updaterService.getVersion();
    } catch (err) {
      console.error('Failed to get version:', err);
    }
  }

  function clearDiscoveredUpdate(): void {
    updateAvailable.value = false;
    isUpdateDownloaded.value = false;
    updateInfo.value = null;
    error.value = null;
    availableActionsDismissed.value = false;
    installActionsDismissed.value = false;
    showNoUpdateResult.value = false;
  }

  function handleUpdateChecking(): void {
    isChecking.value = true;
    error.value = null;
    showNoUpdateResult.value = false;
  }

  function handleUpdateAvailable(info: UpdateInfo): void {
    isChecking.value = false;
    updateAvailable.value = true;
    isUpdateDownloaded.value = false;
    updateInfo.value = info;
    availableActionsDismissed.value = false;
    installActionsDismissed.value = false;
    showNoUpdateResult.value = false;
  }

  function handleUpdateNotAvailable(): void {
    isChecking.value = false;
    updateAvailable.value = false;
    isUpdateDownloaded.value = false;
    updateInfo.value = null;
    availableActionsDismissed.value = false;
    installActionsDismissed.value = false;
    showNoUpdateResult.value = !isSilentCheck.value;
  }

  function handleDownloadProgress(progress: ProgressInfo): void {
    downloadProgress.value = progress;
  }

  function handleUpdateDownloaded(info: UpdateInfo): void {
    isDownloading.value = false;
    updateAvailable.value = true;
    isUpdateDownloaded.value = true;
    updateInfo.value = info;
    availableActionsDismissed.value = true;
    installActionsDismissed.value = false;
  }

  function handleUpdateError(errorInfo: ErrorInfo): void {
    isChecking.value = false;
    isDownloading.value = false;
    error.value = errorInfo;
    showNoUpdateResult.value = false;
  }

  async function checkForUpdates(silent = false): Promise<void> {
    if (isChecking.value) return;

    isSilentCheck.value = silent;
    isChecking.value = true;
    error.value = null;
    availableActionsDismissed.value = false;
    showNoUpdateResult.value = false;

    try {
      await updaterService.check(silent);
    } catch (err) {
      error.value = {
        message: getErrorMessage(err as Error | { message?: string }, translate('updater.checkFailed')),
        code: 'CHECK_FAILED',
      };
      isChecking.value = false;
      showNoUpdateResult.value = false;
    }
  }

  async function downloadUpdate(): Promise<void> {
    if (isDownloading.value) return;

    isDownloading.value = true;
    isUpdateDownloaded.value = false;
    availableActionsDismissed.value = true;
    installActionsDismissed.value = false;
    error.value = null;
    downloadProgress.value = {
      percent: 0,
      bytesPerSecond: 0,
      transferred: 0,
      total: 0,
    };

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

  function dismissAvailableUpdateActions(): void {
    availableActionsDismissed.value = true;
  }

  function dismissInstallActions(): void {
    installActionsDismissed.value = true;
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
  }

  function dispose(): void {
    cleanupListeners?.();
    cleanupListeners = null;
    initialized = false;
  }

  return {
    currentVersion,
    isChecking,
    isDownloading,
    updateAvailable,
    isUpdateDownloaded,
    updateInfo,
    downloadProgress,
    error,
    showNoUpdateResult,
    updatePanelState,
    showAvailableUpdateActions,
    showInstallActions,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    dismissAvailableUpdateActions,
    dismissInstallActions,
    getCurrentVersion,
    updateConfig,
    clearDiscoveredUpdate,
    initialize,
    dispose,
  };
});
