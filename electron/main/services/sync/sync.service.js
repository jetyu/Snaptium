import path from 'node:path';
import { BrowserWindow, dialog } from 'electron';
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
  parseRemoteManifest,
  readLocalFile,
  scanLocalDatabase,
  writeLocalFile,
} from './manifest.service.js';
import { mergeNodesJsonl } from './nodes-merge.service.js';
import { syncStateService } from './state.service.js';
import { createWebDavProvider } from './providers/webdav.provider.js';
import { createS3Provider } from './providers/s3.provider.js';

const NODES_RELATIVE_PATH = VFS_CONSTANTS.NODES_FILE;
const DATABASE_REMOTE_ROOT = VFS_CONSTANTS.DATABASE_FOLDER;
const MANIFEST_REMOTE_PATH = path.posix.join(SYNC_REMOTE_METADATA.DIRECTORY, SYNC_REMOTE_METADATA.MANIFEST_FILE);
const LOCK_REMOTE_PATH = path.posix.join(SYNC_REMOTE_METADATA.DIRECTORY, SYNC_REMOTE_METADATA.LOCK_FILE);

function createSummary() {
  return {
    uploaded: 0,
    downloaded: 0,
    deletedLocal: 0,
    deletedRemote: 0,
    merged: 0,
    conflicts: 0,
  };
}

function cloneSyncConfig(syncConfig = {}) {
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

function normalizeIntervalMinutes(value) {
  const supportedIntervals = new Set(Object.values(SYNC_INTERVALS));
  const normalized = Number(value);
  return supportedIntervals.has(normalized) ? normalized : SYNC_INTERVALS.MANUAL;
}

function normalizeSyncConfig(syncConfig = {}) {
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

function isConfigReady(config) {
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

function getFocusedWindow() {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;
}

function createProvider(config) {
  if (config.provider === SYNC_PROVIDERS.WEBDAV) {
    return createWebDavProvider({
      remotePath: config.remotePath,
      ...config.webdav,
    });
  }

  if (config.provider === SYNC_PROVIDERS.OSS_S3) {
    return createS3Provider({
      remotePath: config.remotePath,
      ...config.ossS3,
    });
  }

  const error = new Error('Unsupported sync provider');
  error.code = SYNC_ERROR_CODES.UNSUPPORTED_PROVIDER;
  throw error;
}

function toRemoteDataPath(relativePath = '') {
  return relativePath
    ? path.posix.join(DATABASE_REMOTE_ROOT, relativePath)
    : DATABASE_REMOTE_ROOT;
}

function pickWinningEntry(localEntry, remoteEntry) {
  const localModifiedAt = Number(localEntry?.modifiedAt ?? 0);
  const remoteModifiedAt = Number(remoteEntry?.modifiedAt ?? 0);

  if (localModifiedAt === remoteModifiedAt) {
    return 'local';
  }

  return localModifiedAt > remoteModifiedAt ? 'local' : 'remote';
}

function createSyncError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

async function loadRemoteManifest(provider) {
  const manifestText = await provider.readText(MANIFEST_REMOTE_PATH);
  if (!manifestText) {
    return null;
  }

  return parseRemoteManifest(manifestText);
}

async function scanRemoteManifest(provider) {
  const files = await provider.listFiles(DATABASE_REMOTE_ROOT);
  const entries = [];

  for (const file of files) {
    if (!file.path.startsWith(`${DATABASE_REMOTE_ROOT}/`)) {
      continue;
    }

    const relativePath = file.path.slice(DATABASE_REMOTE_ROOT.length + 1);
    const content = await provider.readText(file.path);
    if (content === null) {
      continue;
    }
    entries.push(createManifestEntry(relativePath, content, file.modifiedAt));
  }

  return createManifestFromEntries(entries);
}

async function loadRemoteManifestOrScan(provider) {
  const manifest = await loadRemoteManifest(provider);
  if (manifest) {
    return manifest;
  }

  return await scanRemoteManifest(provider);
}

async function acquireRemoteLock(provider, sessionId) {
  const now = Date.now();
  const existingLockText = await provider.readText(LOCK_REMOTE_PATH);

  if (existingLockText) {
    try {
      const existingLock = JSON.parse(existingLockText);
      if (Number(existingLock.expiresAt ?? 0) > now && existingLock.sessionId !== sessionId) {
        throw createSyncError(SYNC_ERROR_CODES.REMOTE_LOCKED, $t('sync.error.remoteLocked'));
      }
    } catch (error) {
      if (error?.code === SYNC_ERROR_CODES.REMOTE_LOCKED) {
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

async function releaseRemoteLock(provider) {
  await provider.deleteFile(LOCK_REMOTE_PATH).catch(() => undefined);
}

async function confirmBootstrapAction(kind) {
  const dialogOptions = kind === 'pull-remote'
    ? {
      message: $t('sync.bootstrap.remoteHasData'),
      confirmLabel: $t('sync.bootstrap.pullRemote'),
    }
    : {
      message: $t('sync.bootstrap.localHasData'),
      confirmLabel: $t('sync.bootstrap.pushLocal'),
    };

  const { response } = await dialog.showMessageBox(getFocusedWindow(), {
    type: 'question',
    buttons: [$t('dialog.cancel'), dialogOptions.confirmLabel],
    defaultId: 1,
    cancelId: 0,
    noLink: true,
    title: $t('sync.bootstrap.title'),
    message: dialogOptions.message,
  });

  return response === 1;
}

async function uploadFile(provider, workspaceRoot, relativePath, summary) {
  const content = await readLocalFile(workspaceRoot, relativePath);
  await provider.writeText(toRemoteDataPath(relativePath), content);
  summary.uploaded += 1;
}

async function downloadFile(provider, workspaceRoot, relativePath, summary) {
  const content = await provider.readText(toRemoteDataPath(relativePath));
  if (content === null) {
    return;
  }
  await writeLocalFile(workspaceRoot, relativePath, content);
  summary.downloaded += 1;
}

async function deleteRemoteFile(provider, relativePath, summary) {
  await provider.deleteFile(toRemoteDataPath(relativePath));
  summary.deletedRemote += 1;
}

async function deleteLocalDatabaseFile(workspaceRoot, relativePath, summary) {
  await deleteLocalFile(workspaceRoot, relativePath);
  summary.deletedLocal += 1;
}

async function mergeNodesFile(provider, workspaceRoot, remoteManifest, state, summary) {
  const localText = await readLocalFile(workspaceRoot, NODES_RELATIVE_PATH).catch(() => '');
  const remoteText = remoteManifest.files[NODES_RELATIVE_PATH]
    ? await provider.readText(toRemoteDataPath(NODES_RELATIVE_PATH)) ?? ''
    : '';
  const mergedText = mergeNodesJsonl({
    baseText: state.baselineNodesContent ?? '',
    localText,
    remoteText,
  });

  await writeLocalFile(workspaceRoot, NODES_RELATIVE_PATH, mergedText);
  await provider.writeText(toRemoteDataPath(NODES_RELATIVE_PATH), mergedText);
  summary.merged += 1;
}

async function applyBootstrap(provider, workspaceRoot, localManifest, remoteManifest, state) {
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

async function applyIncrementalSync(provider, workspaceRoot, baseManifest, localManifest, remoteManifest, state) {
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

async function persistLastSyncedAt(timestamp) {
  const config = await settingsService.loadConfig();
  await settingsService.saveConfig({
    ...config,
    sync: {
      ...config.sync,
      lastSyncedAt: timestamp,
    },
  });
}

async function writeRemoteManifest(provider, manifest) {
  await provider.writeText(MANIFEST_REMOTE_PATH, JSON.stringify(manifest, null, 2));
}

export const syncService = {
  async testConnection(syncConfig) {
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
        error?.message || $t('sync.error.connectionFailed')
      );
    }
  },

  async getStatus() {
    const workspaceRoot = await vfsService.ensureInitialized().catch(() => null);
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

  async runSync(syncConfig, options = {}) {
    const config = normalizeSyncConfig(syncConfig);
    if (!config.enabled) {
      throw createSyncError(SYNC_ERROR_CODES.NOT_CONFIGURED, $t('sync.error.notConfigured'));
    }

    if (!isConfigReady(config)) {
      throw createSyncError(SYNC_ERROR_CODES.NOT_CONFIGURED, $t('sync.error.notConfigured'));
    }

    const workspaceRoot = await vfsService.ensureInitialized().catch(() => null);
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
          code: String(error?.code ?? SYNC_ERROR_CODES.UNKNOWN),
          message: error?.message || $t('sync.error.unknown'),
          at: Date.now(),
        },
      });
      await releaseRemoteLock(provider);
      throw error;
    }
  },
};