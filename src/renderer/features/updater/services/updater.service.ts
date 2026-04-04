import { electronApi } from '@renderer/core/bridge/electronApi';

export const updaterService = {
  onCheckForUpdates: (callback: () => void): (() => void) =>
    electronApi.menu.onCheckForUpdates(callback),

  check: (silent = false): Promise<{ success: boolean }> =>
    electronApi.updater.check(silent),

  download: (): Promise<{ success: boolean }> =>
    electronApi.updater.download(),

  install: (): Promise<{ success: boolean }> =>
    electronApi.updater.install(),

  getVersion: (): Promise<string> =>
    electronApi.updater.getVersion(),

  updateConfig: (config: { autoCheckUpdates: boolean; updateCheckInterval: number }): Promise<{ success: boolean }> =>
    electronApi.updater.updateConfig(config),

  onChecking: (callback: () => void): (() => void) =>
    electronApi.updater.onChecking(callback),

  onAvailable: (callback: (data: any) => void): (() => void) =>
    electronApi.updater.onAvailable(callback),

  onNotAvailable: (callback: (data: any) => void): (() => void) =>
    electronApi.updater.onNotAvailable(callback),

  onDownloadProgress: (callback: (data: any) => void): (() => void) =>
    electronApi.updater.onDownloadProgress(callback),

  onDownloaded: (callback: (data: any) => void): (() => void) =>
    electronApi.updater.onDownloaded(callback),

  onError: (callback: (data: any) => void): (() => void) =>
    electronApi.updater.onError(callback),
};
