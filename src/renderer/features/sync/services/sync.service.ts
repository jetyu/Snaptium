import { i18n } from '@renderer/features/i18n';
import {
  electronApi,
  type JsonObject,
  type SyncErrorInfo,
  type SyncRestoreRemoteKeySlotsResult,
  type SyncRunResult as BridgeSyncRunResult,
  type SyncStatusResult as BridgeSyncStatusResult,
  type SyncSummary,
  type SyncTestConnectionResult,
} from '@renderer/core/bridge/electronApi';
import { DEFAULT_SYNC_SETTINGS, SYNC_PROVIDERS } from '@shared/sync.constants';
import type { SyncSettings } from '@renderer/features/settings/store/settings.store';

export type SyncTrigger = 'manual' | 'timer' | 'save';

export interface SyncRunResult {
  success: boolean;
  syncedAt: number | null;
  summary: SyncSummary | null;
  recoveredPendingSession: boolean;
}

export interface SyncStatusSnapshot {
  lastSyncedAt: number | null;
  lastSummary: SyncSummary | null;
  lastError: SyncErrorInfo | null;
  recoveredPendingSession: boolean;
}

export interface SyncRestoreKeySlotsResult {
  success: boolean;
  restored: boolean;
}

function createDefaultConfig(): SyncSettings {
  return {
    ...DEFAULT_SYNC_SETTINGS,
    webdav: { ...DEFAULT_SYNC_SETTINGS.webdav },
    ossS3: { ...DEFAULT_SYNC_SETTINGS.ossS3 },
  };
}

function normalizeSyncSummary(payload: unknown): SyncSummary | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const summary = payload as Partial<SyncSummary>;
  return {
    uploaded: Number(summary.uploaded ?? 0),
    downloaded: Number(summary.downloaded ?? 0),
    deletedLocal: Number(summary.deletedLocal ?? 0),
    deletedRemote: Number(summary.deletedRemote ?? 0),
    merged: Number(summary.merged ?? 0),
    conflicts: Number(summary.conflicts ?? 0),
  };
}

function resolveFallbackErrorMessage(code: string): string {
  const t = i18n.global.t.bind(i18n.global);
  const fallbackMessages: Record<string, string> = {
    CANCELLED: t('sync.error.cancelled'),
    KEY_SLOTS_RESTORED: t('sync.notice.keySlotsRestored'),
    NOT_CONFIGURED: t('sync.error.notConfigured'),
    PENDING_SESSION_RECOVERED: t('sync.notice.pendingRecovered'),
    PROVIDER_CONNECTION_FAILED: t('sync.error.connectionFailed'),
    REMOTE_LOCKED: t('sync.error.remoteLocked'),
    WORKSPACE_UNAVAILABLE: t('sync.error.workspaceUnavailable'),
    E2EE_NOT_UNLOCKED: t('e2ee.error.dekNotUnlocked'),
    MASTER_PASSWORD_REQUIRED: t('e2ee.error.masterPasswordRequired'),
  };

  return fallbackMessages[code] ?? t('sync.error.unknown');
}

function createSyncRunError(code: string, message: string): Error {
  const error = new Error(message);
  (error as Error & { code: string }).code = code;
  return error;
}

export function normalizeSyncError(error: unknown): SyncErrorInfo {
  // Error values from runtime boundary are not guaranteed to be Error instances.
  if (error instanceof Error) {
    const errorWithCode = error as Error & { code?: string };
    const code = String(errorWithCode.code ?? 'UNKNOWN');
    return {
      code,
      message: error.message || resolveFallbackErrorMessage(code),
    };
  }

  const normalized = (typeof error === 'object' && error !== null ? error : {}) as Partial<SyncErrorInfo>;
  const code = typeof normalized.code === 'string' ? normalized.code : 'UNKNOWN';
  return {
    code,
    message: typeof normalized.message === 'string' && normalized.message.trim().length > 0
      ? normalized.message
      : resolveFallbackErrorMessage(code),
    at: Number.isFinite(Number(normalized.at)) ? Number(normalized.at) : undefined,
  };
}

export function normalizeSyncConfig(syncConfig?: Partial<SyncSettings> | null): SyncSettings {
  const merged = {
    ...createDefaultConfig(),
    ...(syncConfig ?? {}),
    webdav: {
      ...createDefaultConfig().webdav,
      ...(syncConfig?.webdav ?? {}),
    },
    ossS3: {
      ...createDefaultConfig().ossS3,
      ...(syncConfig?.ossS3 ?? {}),
    },
  };

  return {
    ...merged,
    enabled: Boolean(merged.enabled),
    provider: merged.provider === SYNC_PROVIDERS.OSS_S3 ? SYNC_PROVIDERS.OSS_S3 : SYNC_PROVIDERS.WEBDAV,
    intervalMinutes: Number(merged.intervalMinutes ?? 0),
    autoSyncOnSave: Boolean(merged.autoSyncOnSave),
    remotePath: String(merged.remotePath ?? DEFAULT_SYNC_SETTINGS.remotePath).trim() || DEFAULT_SYNC_SETTINGS.remotePath,
    webdav: {
      url: String(merged.webdav.url ?? '').trim(),
      username: String(merged.webdav.username ?? '').trim(),
      password: String(merged.webdav.password ?? ''),
    },
    ossS3: {
      endpoint: String(merged.ossS3.endpoint ?? '').trim(),
      region: String(merged.ossS3.region ?? '').trim(),
      bucket: String(merged.ossS3.bucket ?? '').trim(),
      accessKeyId: String(merged.ossS3.accessKeyId ?? '').trim(),
      secretAccessKey: String(merged.ossS3.secretAccessKey ?? ''),
      forcePathStyle: Boolean(merged.ossS3.forcePathStyle),
    },
    lastSyncedAt: Number.isFinite(Number(merged.lastSyncedAt)) ? Number(merged.lastSyncedAt) : null,
  };
}

function ensureSyncApi() {
  if (!electronApi.sync.isAvailable()) {
    throw new Error('Sync bridge is unavailable');
  }
}

function normalizeRunResult(payload: BridgeSyncRunResult): SyncRunResult {
  if (!payload.success) {
    const code = typeof payload.code === 'string' ? payload.code : 'UNKNOWN';
    const message = typeof payload.message === 'string' && payload.message.trim().length > 0
      ? payload.message
      : resolveFallbackErrorMessage(code);
    throw createSyncRunError(code, message);
  }

  return {
    success: true,
    syncedAt: Number.isFinite(Number(payload.syncedAt)) ? Number(payload.syncedAt) : null,
    summary: normalizeSyncSummary(payload.summary),
    recoveredPendingSession: Boolean(payload.recoveredPendingSession),
  };
}

function normalizeStatusSnapshot(payload: BridgeSyncStatusResult): SyncStatusSnapshot {
  return {
    lastSyncedAt: Number.isFinite(Number(payload.lastSyncedAt)) ? Number(payload.lastSyncedAt) : null,
    lastSummary: normalizeSyncSummary(payload.lastSummary),
    lastError: payload.lastError ? normalizeSyncError(payload.lastError) : null,
    recoveredPendingSession: Boolean(payload.recoveredPendingSession),
  };
}

function toSerializableValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function toJsonObject(value: object): JsonObject {
  return JSON.parse(JSON.stringify(value)) as JsonObject;
}

function toBridgeConfig(syncConfig: SyncSettings): JsonObject {
  return toJsonObject(normalizeSyncConfig(syncConfig));
}

export function isSyncConfigReady(syncConfig?: Partial<SyncSettings> | null): boolean {
  const config = normalizeSyncConfig(syncConfig);

  if (config.provider === SYNC_PROVIDERS.WEBDAV) {
    return Boolean(config.webdav.url && config.webdav.username && config.webdav.password);
  }

  return Boolean(
    config.ossS3.endpoint &&
    config.ossS3.region &&
    config.ossS3.bucket &&
    config.ossS3.accessKeyId &&
    config.ossS3.secretAccessKey
  );
}

export const syncService = {
  isAvailable(): boolean {
    return electronApi.sync.isAvailable();
  },

  normalizeSyncConfig,
  isConfigReady: isSyncConfigReady,

  async getStatus(): Promise<SyncStatusSnapshot> {
    ensureSyncApi();
    return normalizeStatusSnapshot(await electronApi.sync.getStatus());
  },

  async testConnection(syncConfig: SyncSettings): Promise<SyncTestConnectionResult> {
    ensureSyncApi();
    return await electronApi.sync.testConnection(toBridgeConfig(syncConfig));
  },

  async restoreRemoteKeySlots(syncConfig: SyncSettings): Promise<SyncRestoreKeySlotsResult> {
    ensureSyncApi();
    const result: SyncRestoreRemoteKeySlotsResult = await electronApi.sync.restoreRemoteKeySlots(toBridgeConfig(syncConfig));
    if (!result.success) {
      const code = result.code ?? 'UNKNOWN';
      throw createSyncRunError(code, result.message ?? resolveFallbackErrorMessage(code));
    }

    return {
      success: true,
      restored: Boolean(result.restored),
    };
  },

  async run(syncConfig: SyncSettings, trigger: SyncTrigger): Promise<SyncRunResult> {
    ensureSyncApi();
    return normalizeRunResult(await electronApi.sync.run({
      config: toBridgeConfig(syncConfig),
      trigger: toSerializableValue(trigger),
    }));
  },
};
