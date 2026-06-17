import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { APP_DISTRIBUTIONS } from '@shared/updater.constants';
import { electronApi } from '@renderer/core/bridge/electronApi';
import i18n from '@renderer/features/i18n/services/i18n.service';
import {
  updaterService,
  type ErrorInfo,
  type ProgressInfo,
  type UpdateEventContext,
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

function createEmptyDownloadProgress(): ProgressInfo {
  return {
    percent: 0,
    bytesPerSecond: 0,
    transferred: 0,
    total: 0,
  };
}

function isCancelledUpdateError(errorInfo: ErrorInfo): boolean {
  return errorInfo.code === 'CANCELLED' || errorInfo.message.trim().toLowerCase() === 'cancelled';
}

export const useUpdaterStore = defineStore('updater', () => {
  const currentVersion = ref('0.0.0');
  const isChecking = ref(false);
  const isDownloading = ref(false);
  const isDownloadRequestPending = ref(false);
  const updateAvailable = ref(false);
  const isUpdateDownloaded = ref(false);
  const updateInfo = ref<UpdateInfo | null>(null);
  const downloadProgress = ref<ProgressInfo>(createEmptyDownloadProgress());
  const error = ref<ErrorInfo | null>(null);
  const availableActionsDismissed = ref(false);
  const installActionsDismissed = ref(false);
  const showNoUpdateResult = ref(false);
  const isSilentChecking = ref(false);
  const isStoreDistribution = ref(false);

  let cleanupListeners: (() => void) | null = null;
  let initialized = false;

  const showAvailableUpdateActions = computed(() =>
    updateAvailable.value &&
    Boolean(updateInfo.value) &&
    !isChecking.value &&
    !isSilentChecking.value &&
    !isDownloading.value &&
    !isDownloadRequestPending.value &&
    !isUpdateDownloaded.value &&
    !availableActionsDismissed.value &&
    !error.value
  );

  const showInstallActions = computed(() =>
    isUpdateDownloaded.value &&
    Boolean(updateInfo.value) &&
    !isChecking.value &&
    !isSilentChecking.value &&
    !isDownloadRequestPending.value &&
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

    if (isChecking.value && !isSilentChecking.value) {
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

  function resetDownloadState(): void {
    isChecking.value = false;
    isDownloading.value = false;
    isUpdateDownloaded.value = false;
    downloadProgress.value = createEmptyDownloadProgress();
  }

  async function syncDistribution(): Promise<void> {
    try {
      isStoreDistribution.value = (await electronApi.app.getDistribution()) === APP_DISTRIBUTIONS.MICROSOFT_STORE;
    } catch (err) {
      console.error('Failed to get app distribution:', err);
      isStoreDistribution.value = false;
    }
  }

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
    isSilentChecking.value = false;
  }

  function handleUpdateChecking(context: UpdateEventContext): void {
    isChecking.value = true;
    isSilentChecking.value = context.silent;

    if (context.silent) {
      return;
    }

    error.value = null;
    showNoUpdateResult.value = false;
  }

  function handleUpdateAvailable(info: UpdateInfo, context: UpdateEventContext): void {
    const previousVersion = updateInfo.value?.version;
    const isSameVersion = previousVersion === info.version;

    isChecking.value = false;
    updateAvailable.value = true;

    if (!isSameVersion) {
      isUpdateDownloaded.value = false;
    }

    updateInfo.value = info;
    isSilentChecking.value = false;
    if (!context.silent || !isSameVersion) {
      availableActionsDismissed.value = false;
      installActionsDismissed.value = false;
    }
    showNoUpdateResult.value = false;
    error.value = null;
  }

  function handleUpdateCancelled(info: UpdateInfo): void {
    resetDownloadState();
    updateAvailable.value = true;
    updateInfo.value = info;
    error.value = null;
    availableActionsDismissed.value = false;
    installActionsDismissed.value = false;
    showNoUpdateResult.value = false;
    isSilentChecking.value = false;
  }

  function handleDownloadStarted(_context: UpdateEventContext): void {
    isChecking.value = false;
    isDownloading.value = true;
    isDownloadRequestPending.value = false;
    isUpdateDownloaded.value = false;
    availableActionsDismissed.value = true;
    installActionsDismissed.value = false;
    error.value = null;
    showNoUpdateResult.value = false;
    downloadProgress.value = createEmptyDownloadProgress();
  }

  function handleUpdateNotAvailable(_info: UpdateInfo, context: UpdateEventContext): void {
    isChecking.value = false;
    isSilentChecking.value = false;

    if (context.silent) {
      return;
    }

    updateAvailable.value = false;
    isUpdateDownloaded.value = false;
    updateInfo.value = null;
    availableActionsDismissed.value = false;
    installActionsDismissed.value = false;
    showNoUpdateResult.value = true;
    error.value = null;
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

  function handleUpdateError(errorInfo: ErrorInfo, _context: UpdateEventContext): void {
    isChecking.value = false;
    isDownloading.value = false;
    isDownloadRequestPending.value = false;
    isSilentChecking.value = false;
    if (isCancelledUpdateError(errorInfo)) {
      resetDownloadState();
      updateAvailable.value = true;
      error.value = null;
      availableActionsDismissed.value = false;
      installActionsDismissed.value = false;
      showNoUpdateResult.value = false;
      return;
    }
    error.value = errorInfo;
    showNoUpdateResult.value = false;
  }

  async function checkForUpdates(silent = false): Promise<void> {
    if (isStoreDistribution.value) return;
    if (isChecking.value) return;

    isChecking.value = true;
    error.value = null;
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
    if (isStoreDistribution.value) return;
    if (isDownloading.value || isDownloadRequestPending.value) return;

    isDownloadRequestPending.value = true;
    isDownloading.value = true;
    isUpdateDownloaded.value = false;
    availableActionsDismissed.value = true;
    installActionsDismissed.value = false;
    error.value = null;
    downloadProgress.value = createEmptyDownloadProgress();

    try {
      await updaterService.download();
    } catch (err) {
      error.value = {
        message: getErrorMessage(err as Error | { message?: string }, translate('updater.downloadFailed')),
        code: 'DOWNLOAD_FAILED',
      };
    } finally {
      isDownloading.value = false;
      isDownloadRequestPending.value = false;
    }
  }

  async function cancelDownload(): Promise<void> {
    if (isStoreDistribution.value) {
      return;
    }

    if (!isDownloading.value) {
      return;
    }

    await updaterService.cancelDownload();
  }

  async function installUpdate(): Promise<void> {
    if (isStoreDistribution.value) {
      return;
    }

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
    if (isStoreDistribution.value) {
      return;
    }

    try {
      await updaterService.updateConfig(config);
    } catch (err) {
      console.error('Failed to update config:', err);
    }
  }

  async function initialize(): Promise<void> {
    if (initialized) {
      return;
    }

    initialized = true;
    await syncDistribution();
    void getCurrentVersion();
    cleanupListeners = updaterService.subscribe({
      onChecking: handleUpdateChecking,
      onAvailable: handleUpdateAvailable,
      onCancelled: handleUpdateCancelled,
      onNotAvailable: handleUpdateNotAvailable,
      onDownloadStarted: handleDownloadStarted,
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
    isStoreDistribution,
    updatePanelState,
    isDownloadRequestPending,
    showAvailableUpdateActions,
    showInstallActions,
    checkForUpdates,
    downloadUpdate,
    cancelDownload,
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
