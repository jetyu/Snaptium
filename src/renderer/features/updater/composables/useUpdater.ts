import { ref, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  updaterService,
  type ErrorInfo,
  type ProgressInfo,
  type UpdateInfo,
} from '../services/updater.service';

export function useUpdater() {
  const { t } = useI18n();
  const getErrorMessage = (err: Error | { message?: string } | string | null | undefined, fallback: string): string => {
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
  };

  const currentVersion = ref('');
  const isChecking = ref(false);
  const isDownloading = ref(false);
  const updateAvailable = ref(false);
  const isSilentCheck = ref(true);
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
  const notificationState = ref<'available' | 'not-available' | 'error'>('available');

  const checkForUpdates = async (silent = false) => {
    if (isChecking.value) return;

    isSilentCheck.value = silent;
    isChecking.value = true;
    error.value = null;

    try {
      await updaterService.check(silent);
    } catch (err) {
      error.value = {
        message: getErrorMessage(err as Error | { message?: string }, t('updater.checkFailed')),
        code: 'CHECK_FAILED',
      };
      if (!silent) {
        notificationState.value = 'error';
        showNotification.value = true;
      }
    } finally {
      isChecking.value = false;
    }
  };

  const downloadUpdate = async () => {
    if (isDownloading.value) return;

    isDownloading.value = true;
    showNotification.value = false;
    showProgressDialog.value = true;
    error.value = null;

    try {
      await updaterService.download();
    } catch (err) {
      error.value = {
        message: getErrorMessage(err as Error | { message?: string }, t('updater.downloadFailed')),
        code: 'DOWNLOAD_FAILED',
      };
      isDownloading.value = false;
    }
  };

  const installUpdate = async () => {
    try {
      await updaterService.install();
    } catch (err) {
      console.error('Failed to install update:', err);
    }
  };

  const getCurrentVersion = async () => {
    try {
      currentVersion.value = await updaterService.getVersion();
    } catch (err) {
      console.error('Failed to get version:', err);
    }
  };

  const updateConfig = async (config: { autoCheckUpdates: boolean; updateCheckInterval: number }) => {
    try {
      await updaterService.updateConfig(config);
    } catch (err) {
      console.error('Failed to update config:', err);
    }
  };

  const handleUpdateChecking = () => {
    isChecking.value = true;
  };

  const handleUpdateAvailable = (info: UpdateInfo) => {
    isChecking.value = false;
    updateAvailable.value = true;
    updateInfo.value = info;
    notificationState.value = 'available';
    showNotification.value = true;
  };

  const handleUpdateNotAvailable = () => {
    isChecking.value = false;
    updateAvailable.value = false;
    notificationState.value = 'not-available';
    if (!isSilentCheck.value) {
      showNotification.value = true;
    }
  };

  const handleDownloadProgress = (progress: ProgressInfo) => {
    downloadProgress.value = progress;
  };

  const handleUpdateDownloaded = (info: UpdateInfo) => {
    isDownloading.value = false;
    showProgressDialog.value = false;
    updateInfo.value = info;
    showInstallDialog.value = true;
  };

  const handleUpdateError = (errorInfo: ErrorInfo) => {
    isChecking.value = false;
    isDownloading.value = false;
    error.value = errorInfo;

    if (!showProgressDialog.value) {
      notificationState.value = 'error';
      showNotification.value = true;
    }
  };

  const initMainProcessListeners = () => {
    return updaterService.onCheckForUpdates(() => {
      checkForUpdates(false);
    });
  };

  let cleanupListeners: (() => void) | null = null;

  onMounted(() => {
    getCurrentVersion();
    cleanupListeners = updaterService.subscribe({
      onChecking: handleUpdateChecking,
      onAvailable: handleUpdateAvailable,
      onNotAvailable: handleUpdateNotAvailable,
      onDownloadProgress: handleDownloadProgress,
      onDownloaded: handleUpdateDownloaded,
      onError: handleUpdateError,
    });
  });

  onUnmounted(() => {
    cleanupListeners?.();
    cleanupListeners = null;
  });

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
    initMainProcessListeners,
  };
}
