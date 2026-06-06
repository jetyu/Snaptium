import { electronApi } from '@renderer/core/bridge/electronApi';
import { normalizeUpdateChannel, type UpdateChannel } from '@shared/updater.constants';

const MIN_UPDATE_INTERVAL = 60 * 60 * 1000;

export interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: string;
  files?: unknown[];
}

export interface ProgressInfo {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

export interface ErrorInfo {
  message: string;
  code: string;
}

export interface UpdaterConfig {
  autoCheckUpdates: boolean;
  updateCheckInterval: number;
  updateChannel: UpdateChannel;
}

export interface UpdateEventHandlers {
  onChecking?: () => void;
  onAvailable?: (info: UpdateInfo) => void;
  onNotAvailable?: (info: UpdateInfo) => void;
  onDownloadProgress?: (progress: ProgressInfo) => void;
  onDownloaded?: (info: UpdateInfo) => void;
  onError?: (error: ErrorInfo) => void;
}

function normalizeUpdateInfo(payload: unknown): UpdateInfo {
  const info = (typeof payload === 'object' && payload !== null ? payload : {}) as Partial<UpdateInfo>;
  return {
    version: typeof info.version === 'string' ? info.version : '',
    releaseDate: typeof info.releaseDate === 'string' ? info.releaseDate : undefined,
    releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
    files: Array.isArray(info.files) ? info.files : undefined,
  };
}

function normalizeProgressInfo(payload: unknown): ProgressInfo {
  const progress = (typeof payload === 'object' && payload !== null ? payload : {}) as Partial<ProgressInfo>;
  return {
    percent: Number(progress.percent ?? 0),
    bytesPerSecond: Number(progress.bytesPerSecond ?? 0),
    transferred: Number(progress.transferred ?? 0),
    total: Number(progress.total ?? 0),
  };
}

function normalizeErrorInfo(payload: unknown): ErrorInfo {
  if (payload instanceof Error) {
    return {
      message: payload.message,
      code: 'UNKNOWN',
    };
  }

  const errorInfo = (typeof payload === 'object' && payload !== null ? payload : {}) as Partial<ErrorInfo>;
  return {
    message: typeof errorInfo.message === 'string' ? errorInfo.message : 'Unknown updater error',
    code: typeof errorInfo.code === 'string' ? errorInfo.code : 'UNKNOWN',
  };
}

function normalizeUpdaterConfig(config: UpdaterConfig): UpdaterConfig {
  return {
    autoCheckUpdates: Boolean(config.autoCheckUpdates),
    updateCheckInterval: Math.max(MIN_UPDATE_INTERVAL, Math.trunc(config.updateCheckInterval || MIN_UPDATE_INTERVAL)),
    updateChannel: normalizeUpdateChannel(config.updateChannel),
  };
}

export const updaterService = {
  onCheckForUpdates(callback: () => void): () => void {
    return electronApi.menu.onCheckForUpdates(() => {
      callback();
    });
  },

  async check(silent = false): Promise<{ success: boolean }> {
    return await electronApi.updater.check(Boolean(silent));
  },

  async download(): Promise<{ success: boolean }> {
    return await electronApi.updater.download();
  },

  async install(): Promise<{ success: boolean }> {
    return await electronApi.updater.install();
  },

  async getVersion(): Promise<string> {
    const version = await electronApi.updater.getVersion();
    const normalized = version.trim();
    return normalized || '0.0.0';
  },

  async updateConfig(config: UpdaterConfig): Promise<{ success: boolean }> {
    return await electronApi.updater.updateConfig(normalizeUpdaterConfig(config));
  },

  subscribe(handlers: UpdateEventHandlers): () => void {
    const cleanups = [
      electronApi.updater.onChecking(() => handlers.onChecking?.()),
      electronApi.updater.onAvailable((payload: unknown) => handlers.onAvailable?.(normalizeUpdateInfo(payload))),
      electronApi.updater.onNotAvailable((payload: unknown) => handlers.onNotAvailable?.(normalizeUpdateInfo(payload))),
      electronApi.updater.onDownloadProgress((payload: unknown) => handlers.onDownloadProgress?.(normalizeProgressInfo(payload))),
      electronApi.updater.onDownloaded((payload: unknown) => handlers.onDownloaded?.(normalizeUpdateInfo(payload))),
      electronApi.updater.onError((payload: unknown) => handlers.onError?.(normalizeErrorInfo(payload))),
    ];

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  },
};
