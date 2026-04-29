import path from 'node:path';
import { BrowserWindow, dialog, type MessageBoxOptions } from 'electron';
import { $t } from '../../utils/i18n.js';
import {
  DEFAULT_SYNC_SETTINGS,
  SYNC_ERROR_CODES,
  SYNC_INTERVALS,
  SYNC_PROVIDERS,
  SYNC_REMOTE_METADATA,
  SYNC_RUNTIME,
} from '../../../shared/sync.constants.js';
import { VFS_CONSTANTS } from '../../constants/vfs.constants.js';
import { settingsService } from '../settings.service.js';
import { vfsService } from '../vfs.service.js';
import {
  createEmptyManifest,
  createManifestEntry,
  createManifestFromEntries,
  deleteLocalFile,
  diffManifest,
  isManifestEmpty,
  type ManifestEntry,
  parseRemoteManifest,
  readLocalFile,
  scanLocalDatabase,
  type SyncManifest,
  writeLocalFile,
} from './manifest.service.js';
import { mergeNodesJsonl } from './nodes-merge.service.js';
import { syncStateService } from './state.service.js';
import { createWebDavProvider } from './providers/webdav.provider.js';
import { createS3Provider } from './providers/s3.provider.js';
import { getErrorCode, getErrorMessage } from '../../../shared/utils/error.utils.js';

import { keyManagerService } from '../key-manager.service.js';
import { cryptoService } from '../crypto.service.js';

const NODES_RELATIVE_PATH = VFS_CONSTANTS.NODES_FILE;
const DATABASE_REMOTE_ROOT = VFS_CONSTANTS.DATABASE_FOLDER;
const MANIFEST_REMOTE_PATH = path.posix.join(SYNC_REMOTE_METADATA.DIRECTORY, SYNC_REMOTE_METADATA.MANIFEST_FILE);
const LOCK_REMOTE_PATH = path.posix.join(SYNC_REMOTE_METADATA.DIRECTORY, SYNC_REMOTE_METADATA.LOCK_FILE);

type SyncProviderType = (typeof SYNC_PROVIDERS)[keyof typeof SYNC_PROVIDERS];

interface SyncWebDavConfig {
  url: string;
  username: string;
  password: string;
}

interface SyncS3Config {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

interface NormalizedSyncConfig {
  enabled: boolean;
  provider: SyncProviderType;
  intervalMinutes: number;
  autoSyncOnSave: boolean;
  remotePath: string;
  webdav: SyncWebDavConfig;
  ossS3: SyncS3Config;
  lastSyncedAt: number | null;
}

type SyncConfigInput = Partial<NormalizedSyncConfig> & {
  webdav?: Partial<SyncWebDavConfig>;
  ossS3?: Partial<SyncS3Config>;
};

interface SyncSummary {
  uploaded: number;
  downloaded: number;
  deletedLocal: number;
  deletedRemote: number;
  merged: number;
  conflicts: number;
}

interface RemoteFileEntry {
  path: string;
  size: number;
  modifiedAt: number;
}

interface SyncProviderClient {
  testConnection(): Promise<void>;
  listFiles(relativeDirectory?: string): Promise<RemoteFileEntry[]>;
  readText(relativePath: string): Promise<string | null>;
  writeText(relativePath: string, content: string): Promise<void>;
  deleteFile(relativePath: string): Promise<void>;
}

interface SyncSession {
  id: string;
  status: 'syncing';
  trigger: 'manual' | 'timer' | 'save';
  startedAt: number;
}

interface SyncStateSnapshot {
  baselineManifest: SyncManifest | null;
  baselineNodesContent: string | null;
  lastSyncedAt: number | null;
  lastSummary: SyncSummary | null;
  lastError: { code: string; message: string; at?: number } | null;
  session: SyncSession | null;
}

interface SyncRunOptions {
  trigger?: 'manual' | 'timer' | 'save';
}

interface SyncServiceError extends Error {
  code: string;
}

function createSummary(): SyncSummary {
  return {
    uploaded: 0,
    downloaded: 0,
    deletedLocal: 0,
    deletedRemote: 0,
    merged: 0,
    conflicts: 0,
  };
}

function cloneSyncConfig(syncConfig: SyncConfigInput = {}): NormalizedSyncConfig {
  return {
    ...DEFAULT_SYNC_SETTINGS,
    ...syncConfig,
    webdav: {
      ...DEFAULT_SYNC_SETTINGS.webdav,
      ...(syncConfig.webdav ?? {}),
    },
    ossS3: {
      ...DEFAULT_SYNC_SETTINGS.ossS3,
      ...(syncConfig.ossS3 ?? {}),
    },
  };
}

function normalizeIntervalMinutes(value: unknown): number {
  const supportedIntervals: ReadonlySet<number> = new Set<number>(Object.values(SYNC_INTERVALS));
  const normalized = Number(value);
  return supportedIntervals.has(normalized) ? normalized : SYNC_INTERVALS.MANUAL;
}

function normalizeSyncConfig(syncConfig: SyncConfigInput = {}): NormalizedSyncConfig {
  const merged = cloneSyncConfig(syncConfig);

  return {
    ...merged,
    enabled: Boolean(merged.enabled),
    provider: merged.provider === SYNC_PROVIDERS.OSS_S3 ? SYNC_PROVIDERS.OSS_S3 : SYNC_PROVIDERS.WEBDAV,
    intervalMinutes: normalizeIntervalMinutes(merged.intervalMinutes),
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

function isConfigReady(config: NormalizedSyncConfig): boolean {
  if (config.provider === SYNC_PROVIDERS.WEBDAV) {
    return Boolean(config.webdav.url && config.webdav.username && config.webdav.password);
  }

  if (config.provider === SYNC_PROVIDERS.OSS_S3) {
    return Boolean(
      config.ossS3.endpoint &&
      config.ossS3.region &&
      config.ossS3.bucket &&
      config.ossS3.accessKeyId &&
      config.ossS3.secretAccessKey
    );
  }

  return false;
}

function getFocusedWindow(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;
}

function createProvider(config: NormalizedSyncConfig): SyncProviderClient {
  if (config.provider === SYNC_PROVIDERS.WEBDAV) {
    return createWebDavProvider({
      remotePath: config.remotePath,
      ...config.webdav,
    }) as SyncProviderClient;
  }

  if (config.provider === SYNC_PROVIDERS.OSS_S3) {
    return createS3Provider({
      remotePath: config.remotePath,
      ...config.ossS3,
    }) as SyncProviderClient;
  }
  throw createSyncError(SYNC_ERROR_CODES.UNSUPPORTED_PROVIDER, 'Unsupported sync provider');
}

function toRemoteDataPath(relativePath = ''): string {
  return relativePath
    ? path.posix.join(DATABASE_REMOTE_ROOT, relativePath)
    : DATABASE_REMOTE_ROOT;
}

function pickWinningEntry(localEntry: ManifestEntry | null, remoteEntry: ManifestEntry | null): 'local' | 'remote' {
  const localModifiedAt = Number(localEntry?.modifiedAt ?? 0);
  const remoteModifiedAt = Number(remoteEntry?.modifiedAt ?? 0);

  if (localModifiedAt === remoteModifiedAt) {
    return 'local';
  }

  return localModifiedAt > remoteModifiedAt ? 'local' : 'remote';
}

function createSyncError(code: string, message: string): SyncServiceError {
  const error = new Error(message) as SyncServiceError;
  error.code = code;
  return error;
}

async function loadRemoteManifest(provider: SyncProviderClient): Promise<SyncManifest | null> {
  const manifestText = await provider.readText(MANIFEST_REMOTE_PATH);
  if (!manifestText) {
    return null;
  }

  // Decrypt manifest if it is encrypted
  const decryptedText = keyManagerService.isUnlocked()
    ? cryptoService.decryptContent(manifestText, keyManagerService.getDEK())
    : manifestText;

  return parseRemoteManifest(decryptedText);
}

async function scanRemoteManifest(provider: SyncProviderClient): Promise<SyncManifest> {
  const files = await provider.listFiles(DATABASE_REMOTE_ROOT);
  const entries: ManifestEntry[] = [];
  const dek = keyManagerService.isUnlocked() ? keyManagerService.getDEK() : null;

  for (const file of files) {
    if (!file.path.startsWith(`${DATABASE_REMOTE_ROOT}/`)) {
      continue;
    }

    const relativePath = file.path.slice(DATABASE_REMOTE_ROOT.length + 1);
    const ciphertext = await provider.readText(file.path);
    if (ciphertext === null) {
      continue;
    }

    // Decrypt content to calculate SHA256 of the plaintext
    const plaintext = dek ? cryptoService.decryptContent(ciphertext, dek) : ciphertext;
    entries.push(createManifestEntry(relativePath, plaintext, file.modifiedAt));
  }

  return createManifestFromEntries(entries);
}

async function loadRemoteManifestOrScan(provider: SyncProviderClient): Promise<SyncManifest> {
  const manifest = await loadRemoteManifest(provider);
  if (manifest) {
    return manifest;
  }

  return await scanRemoteManifest(provider);
}

async function acquireRemoteLock(provider: SyncProviderClient, sessionId: string): Promise<void> {
  const now = Date.now();
  const existingLockText = await provider.readText(LOCK_REMOTE_PATH);

  if (existingLockText) {
    try {
      const existingLock = JSON.parse(existingLockText);
      if (Number(existingLock.expiresAt ?? 0) > now && existingLock.sessionId !== sessionId) {
        throw createSyncError(SYNC_ERROR_CODES.REMOTE_LOCKED, $t('sync.error.remoteLocked'));
      }
    } catch (error: unknown) {
      if (getErrorCode(error) === SYNC_ERROR_CODES.REMOTE_LOCKED) {
        throw error;
      }
    }
  }

  const nextLock = {
    sessionId,
    acquiredAt: now,
    expiresAt: now + SYNC_RUNTIME.LOCK_TTL_MS,
  };

  await provider.writeText(LOCK_REMOTE_PATH, JSON.stringify(nextLock, null, 2));
}

async function releaseRemoteLock(provider: SyncProviderClient): Promise<void> {
  await provider.deleteFile(LOCK_REMOTE_PATH).catch(() => undefined);
}

async function confirmBootstrapAction(kind: 'pull-remote' | 'push-local'): Promise<boolean> {
  const dialogOptions = kind === 'pull-remote'
    ? {
      message: $t('sync.bootstrap.remoteHasData'),
      confirmLabel: $t('sync.bootstrap.pullRemote'),
    }
    : {
      message: $t('sync.bootstrap.localHasData'),
      confirmLabel: $t('sync.bootstrap.pushLocal'),
    };

  const messageBoxOptions: MessageBoxOptions = {
    type: 'question',
    buttons: [$t('button.cancel'), dialogOptions.confirmLabel],
    defaultId: 1,
    cancelId: 0,
    noLink: true,
    title: $t('sync.bootstrap.title'),
    message: dialogOptions.message,
  };

  const focusedWindow = getFocusedWindow();
  const { response } = focusedWindow
    ? await dialog.showMessageBox(focusedWindow, messageBoxOptions)
    : await dialog.showMessageBox(messageBoxOptions);

  return response === 1;
}

async function uploadFile(
  provider: SyncProviderClient,
  workspaceRoot: string,
  relativePath: string,
  summary: SyncSummary,
): Promise<void> {
  const plaintext = await readLocalFile(workspaceRoot, relativePath);
  const ciphertext = keyManagerService.isUnlocked()
    ? cryptoService.encryptContent(plaintext, keyManagerService.getDEK())
    : plaintext;

  await provider.writeText(toRemoteDataPath(relativePath), ciphertext);
  summary.uploaded += 1;
}

async function downloadFile(
  provider: SyncProviderClient,
  workspaceRoot: string,
  relativePath: string,
  summary: SyncSummary,
): Promise<void> {
  const ciphertext = await provider.readText(toRemoteDataPath(relativePath));
  if (ciphertext === null) {
    return;
  }

  const plaintext = keyManagerService.isUnlocked()
    ? cryptoService.decryptContent(ciphertext, keyManagerService.getDEK())
    : ciphertext;

  await writeLocalFile(workspaceRoot, relativePath, plaintext);
  summary.downloaded += 1;
}

async function deleteRemoteFile(provider: SyncProviderClient, relativePath: string, summary: SyncSummary): Promise<void> {
  await provider.deleteFile(toRemoteDataPath(relativePath));
  summary.deletedRemote += 1;
}

async function deleteLocalDatabaseFile(workspaceRoot: string, relativePath: string, summary: SyncSummary): Promise<void> {
  await deleteLocalFile(workspaceRoot, relativePath);
  summary.deletedLocal += 1;
}

async function mergeNodesFile(
  provider: SyncProviderClient,
  workspaceRoot: string,
  remoteManifest: SyncManifest,
  state: SyncStateSnapshot,
  summary: SyncSummary,
): Promise<void> {
  const localText = await readLocalFile(workspaceRoot, NODES_RELATIVE_PATH).catch(() => '');
  const dek = keyManagerService.isUnlocked() ? keyManagerService.getDEK() : null;

  const remoteCiphertext = remoteManifest.files[NODES_RELATIVE_PATH]
    ? await provider.readText(toRemoteDataPath(NODES_RELATIVE_PATH)) ?? ''
    : '';

  const remoteText = (remoteCiphertext && dek)
    ? cryptoService.decryptContent(remoteCiphertext, dek)
    : remoteCiphertext;

  const mergedText = mergeNodesJsonl({
    baseText: state.baselineNodesContent ?? '',
    localText,
    remoteText,
  });

  const mergedCiphertext = dek
    ? cryptoService.encryptContent(mergedText, dek)
    : mergedText;

  await writeLocalFile(workspaceRoot, NODES_RELATIVE_PATH, mergedText);
  await provider.writeText(toRemoteDataPath(NODES_RELATIVE_PATH), mergedCiphertext);
  summary.merged += 1;
}

async function applyBootstrap(
  provider: SyncProviderClient,
  workspaceRoot: string,
  localManifest: SyncManifest,
  remoteManifest: SyncManifest,
  state: SyncStateSnapshot,
): Promise<SyncSummary> {
  const summary = createSummary();
  const localEmpty = isManifestEmpty(localManifest);
  const remoteEmpty = isManifestEmpty(remoteManifest);

  if (localEmpty && remoteEmpty) {
    return summary;
  }

  if (localEmpty && !remoteEmpty) {
    const confirmed = await confirmBootstrapAction('pull-remote');
    if (!confirmed) {
      throw createSyncError(SYNC_ERROR_CODES.CANCELLED, $t('sync.error.cancelled'));
    }

    for (const relativePath of Object.keys(remoteManifest.files)) {
      await downloadFile(provider, workspaceRoot, relativePath, summary);
    }

    return summary;
  }

  if (!localEmpty && remoteEmpty) {
    const confirmed = await confirmBootstrapAction('push-local');
    if (!confirmed) {
      throw createSyncError(SYNC_ERROR_CODES.CANCELLED, $t('sync.error.cancelled'));
    }

    for (const relativePath of Object.keys(localManifest.files)) {
      await uploadFile(provider, workspaceRoot, relativePath, summary);
    }

    return summary;
  }

  return await applyIncrementalSync(provider, workspaceRoot, createEmptyManifest(), localManifest, remoteManifest, state);
}

async function applyIncrementalSync(
  provider: SyncProviderClient,
  workspaceRoot: string,
  baseManifest: SyncManifest,
  localManifest: SyncManifest,
  remoteManifest: SyncManifest,
  state: SyncStateSnapshot,
): Promise<SyncSummary> {
  const summary = createSummary();
  const localChanges = diffManifest(baseManifest, localManifest);
  const remoteChanges = diffManifest(baseManifest, remoteManifest);
  const paths = new Set([...localChanges.keys(), ...remoteChanges.keys()]);
  const nonNodePaths = [...paths].filter((relativePath) => relativePath !== NODES_RELATIVE_PATH);

  for (const relativePath of nonNodePaths) {
    const localEntry = localManifest.files[relativePath] ?? null;
    const remoteEntry = remoteManifest.files[relativePath] ?? null;
    const localChanged = localChanges.has(relativePath);
    const remoteChanged = remoteChanges.has(relativePath);

    if (localChanged && !remoteChanged) {
      if (localEntry) {
        await uploadFile(provider, workspaceRoot, relativePath, summary);
      } else {
        await deleteRemoteFile(provider, relativePath, summary);
      }
      continue;
    }

    if (!localChanged && remoteChanged) {
      if (remoteEntry) {
        await downloadFile(provider, workspaceRoot, relativePath, summary);
      } else {
        await deleteLocalDatabaseFile(workspaceRoot, relativePath, summary);
      }
      continue;
    }

    if (!localChanged && !remoteChanged) {
      continue;
    }

    if (localEntry && remoteEntry && localEntry.sha256 === remoteEntry.sha256) {
      continue;
    }

    const winner = pickWinningEntry(localEntry, remoteEntry);
    summary.conflicts += 1;

    if (winner === 'local') {
      if (localEntry) {
        await uploadFile(provider, workspaceRoot, relativePath, summary);
      } else if (remoteEntry) {
        await downloadFile(provider, workspaceRoot, relativePath, summary);
      }
      continue;
    }

    if (remoteEntry) {
      await downloadFile(provider, workspaceRoot, relativePath, summary);
    } else if (localEntry) {
      await uploadFile(provider, workspaceRoot, relativePath, summary);
    }
  }

  const localNodesChanged = localChanges.has(NODES_RELATIVE_PATH);
  const remoteNodesChanged = remoteChanges.has(NODES_RELATIVE_PATH);

  if (localNodesChanged && remoteNodesChanged) {
    await mergeNodesFile(provider, workspaceRoot, remoteManifest, state, summary);
  } else if (localNodesChanged) {
    if (localManifest.files[NODES_RELATIVE_PATH]) {
      await uploadFile(provider, workspaceRoot, NODES_RELATIVE_PATH, summary);
    } else {
      await deleteRemoteFile(provider, NODES_RELATIVE_PATH, summary);
    }
  } else if (remoteNodesChanged) {
    if (remoteManifest.files[NODES_RELATIVE_PATH]) {
      await downloadFile(provider, workspaceRoot, NODES_RELATIVE_PATH, summary);
    } else {
      await deleteLocalDatabaseFile(workspaceRoot, NODES_RELATIVE_PATH, summary);
    }
  }

  return summary;
}

async function persistLastSyncedAt(timestamp: number): Promise<void> {
  const config = await settingsService.loadConfig();
  await settingsService.saveConfig({
    ...config,
    sync: {
      ...config.sync,
      lastSyncedAt: timestamp,
    },
  });
}

async function writeRemoteManifest(provider: SyncProviderClient, manifest: SyncManifest): Promise<void> {
  const plaintext = JSON.stringify(manifest, null, 2);
  const ciphertext = keyManagerService.isUnlocked()
    ? cryptoService.encryptContent(plaintext, keyManagerService.getDEK())
    : plaintext;

  await provider.writeText(MANIFEST_REMOTE_PATH, ciphertext);
}

export const syncService = {
  async testConnection(syncConfig: SyncConfigInput): Promise<{ success: boolean }> {
    const config = normalizeSyncConfig(syncConfig);
    if (!isConfigReady(config)) {
      throw createSyncError(SYNC_ERROR_CODES.NOT_CONFIGURED, $t('sync.error.notConfigured'));
    }

    const provider = createProvider(config);
    try {
      await provider.testConnection();
      return { success: true };
    } catch (error) {
      throw createSyncError(
        SYNC_ERROR_CODES.PROVIDER_CONNECTION_FAILED,
        getErrorMessage(error, $t('sync.error.connectionFailed'))
      );
    }
  },

  async getStatus(): Promise<{
    success: boolean;
    lastSyncedAt: number | null;
    lastSummary: SyncSummary | null;
    lastError: { code: string; message: string; at?: number } | null;
    recoveredPendingSession: boolean;
  }> {
    const workspaceRoot = await vfsService.ensureInitialized(undefined).catch(() => null);
    if (!workspaceRoot) {
      return {
        success: true,
        lastSyncedAt: null,
        lastSummary: null,
        lastError: null,
        recoveredPendingSession: false,
      };
    }

    const { state, recoveredPendingSession } = await syncStateService.loadWorkspaceState(workspaceRoot);
    return {
      success: true,
      lastSyncedAt: state.lastSyncedAt,
      lastSummary: state.lastSummary,
      lastError: state.lastError,
      recoveredPendingSession,
    };
  },

  async runSync(
    syncConfig: SyncConfigInput,
    options: SyncRunOptions = {},
  ): Promise<{ success: boolean; syncedAt: number; summary: SyncSummary; recoveredPendingSession: boolean }> {
    const config = normalizeSyncConfig(syncConfig);
    if (!config.enabled) {
      throw createSyncError(SYNC_ERROR_CODES.NOT_CONFIGURED, $t('sync.error.notConfigured'));
    }

    if (!isConfigReady(config)) {
      throw createSyncError(SYNC_ERROR_CODES.NOT_CONFIGURED, $t('sync.error.notConfigured'));
    }

    // ── E2EE Check ───────────────────────────────────────────────────────────
    if (!(await keyManagerService.hasKeySlots())) {
      throw createSyncError(
        SYNC_ERROR_CODES.MASTER_PASSWORD_REQUIRED,
        $t('e2ee.error.masterPasswordRequired'),
      );
    }

    if (!keyManagerService.isUnlocked()) {
      throw createSyncError(
        SYNC_ERROR_CODES.E2EE_NOT_UNLOCKED,
        $t('e2ee.error.dekNotUnlocked'),
      );
    }

    const workspaceRoot = await vfsService.ensureInitialized(undefined).catch(() => null);
    if (!workspaceRoot) {
      throw createSyncError(SYNC_ERROR_CODES.WORKSPACE_UNAVAILABLE, $t('sync.error.workspaceUnavailable'));
    }

    const { state, recoveredPendingSession } = await syncStateService.loadWorkspaceState(workspaceRoot);
    const session = await syncStateService.beginSession(workspaceRoot, options.trigger ?? 'manual');
    const provider = createProvider(config);

    try {
      await provider.testConnection();
      await acquireRemoteLock(provider, session.id);

      const [localManifest, remoteManifest] = await Promise.all([
        scanLocalDatabase(workspaceRoot),
        loadRemoteManifestOrScan(provider),
      ]);

      const summary = state.baselineManifest
        ? await applyIncrementalSync(provider, workspaceRoot, state.baselineManifest, localManifest, remoteManifest, state)
        : await applyBootstrap(provider, workspaceRoot, localManifest, remoteManifest, state);

      const finalManifest = await scanLocalDatabase(workspaceRoot);
      await vfsService.reloadWorkspaceState(workspaceRoot);
      await writeRemoteManifest(provider, finalManifest);

      const finalNodesContent = finalManifest.files[NODES_RELATIVE_PATH]
        ? await readLocalFile(workspaceRoot, NODES_RELATIVE_PATH).catch(() => '')
        : '';
      const syncedAt = Date.now();

      await syncStateService.finishSession(workspaceRoot, {
        baselineManifest: finalManifest,
        baselineNodesContent: finalNodesContent,
        lastSyncedAt: syncedAt,
        lastSummary: summary,
        lastError: null,
      });
      await persistLastSyncedAt(syncedAt);
      await releaseRemoteLock(provider);

      return {
        success: true,
        syncedAt,
        summary,
        recoveredPendingSession,
      };
    } catch (error) {
      await syncStateService.finishSession(workspaceRoot, {
        lastError: {
          code: getErrorCode(error) ?? SYNC_ERROR_CODES.UNKNOWN,
          message: getErrorMessage(error, $t('sync.error.unknown')),
          at: Date.now(),
        },
      });
      await releaseRemoteLock(provider);
      throw error;
    }
  },
};
