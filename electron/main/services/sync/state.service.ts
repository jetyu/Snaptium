import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import { app } from 'electron';
import { VFS_CONSTANTS } from '../../constants/vfs.constants.js';
import { SYNC_RUNTIME } from '../../../shared/sync.constants.js';
import type { SyncManifest } from './manifest.service.js';

const STATE_FILE = 'sync-state.json';

interface SyncSummary {
  uploaded: number;
  downloaded: number;
  deletedLocal: number;
  deletedRemote: number;
  merged: number;
  conflicts: number;
}

export interface SyncErrorInfo {
  code: string;
  message: string;
  at?: number;
}

export interface SyncSession {
  id: string;
  status: 'syncing';
  trigger: 'manual' | 'timer' | 'save';
  startedAt: number;
}

export interface WorkspaceSyncState {
  baselineManifest: SyncManifest | null;
  baselineNodesContent: string | null;
  lastSyncedAt: number | null;
  lastSummary: SyncSummary | null;
  lastError: SyncErrorInfo | null;
  session: SyncSession | null;
}

interface SyncStateFile {
  version: number;
  workspaces: Record<string, WorkspaceSyncState>;
}

type WorkspaceStateUpdater = (state: WorkspaceSyncState) => WorkspaceSyncState | Promise<WorkspaceSyncState>;

function cloneWorkspaceState(state: Partial<WorkspaceSyncState> = {}): WorkspaceSyncState {
  return {
    baselineManifest: state.baselineManifest ?? null,
    baselineNodesContent: typeof state.baselineNodesContent === 'string' ? state.baselineNodesContent : null,
    lastSyncedAt: Number.isFinite(Number(state.lastSyncedAt)) ? Number(state.lastSyncedAt) : null,
    lastSummary: state.lastSummary ?? null,
    lastError: state.lastError ?? null,
    session: state.session ?? null,
  };
}

function getStateFilePath(): string {
  return path.join(app.getPath(VFS_CONSTANTS.USER_DATA), STATE_FILE);
}

function getWorkspaceKey(workspaceRoot: string): string {
  return crypto.createHash('sha256').update(path.resolve(workspaceRoot)).digest('hex');
}

async function readStateFile(): Promise<SyncStateFile> {
  const filePath = getStateFilePath();
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(content) as {
      version?: number;
      workspaces?: Record<string, Partial<WorkspaceSyncState>>;
    };
    const parsedWorkspaces = typeof parsed?.workspaces === 'object' && parsed.workspaces !== null
      ? parsed.workspaces
      : {};
    const workspaces: Record<string, WorkspaceSyncState> = {};
    for (const [workspaceKey, rawState] of Object.entries(parsedWorkspaces)) {
      workspaces[workspaceKey] = cloneWorkspaceState(rawState);
    }
    return {
      version: Number(parsed?.version ?? 1),
      workspaces,
    };
  } catch (error: unknown) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === 'ENOENT') {
      return { version: 1, workspaces: {} };
    }
    throw error;
  }
}

async function writeStateFile(state: SyncStateFile): Promise<void> {
  const filePath = getStateFilePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(state, null, 2), 'utf8');
}

function isRecoverablePendingSession(session: SyncSession | null): boolean {
  if (!session || session.status !== 'syncing') {
    return false;
  }

  return Date.now() - Number(session.startedAt ?? 0) >= SYNC_RUNTIME.SESSION_STALE_MS;
}

async function updateWorkspaceState(workspaceRoot: string, updater: WorkspaceStateUpdater): Promise<WorkspaceSyncState> {
  const currentState = await readStateFile();
  const workspaceKey = getWorkspaceKey(workspaceRoot);
  const nextWorkspaceState = cloneWorkspaceState(
    await updater(cloneWorkspaceState(currentState.workspaces[workspaceKey]))
  );

  currentState.workspaces[workspaceKey] = nextWorkspaceState;
  await writeStateFile(currentState);
  return nextWorkspaceState;
}

export const syncStateService = {
  async loadWorkspaceState(workspaceRoot: string): Promise<{
    state: WorkspaceSyncState;
    recoveredPendingSession: boolean;
  }> {
    const currentState = await readStateFile();
    const workspaceKey = getWorkspaceKey(workspaceRoot);
    const workspaceState = cloneWorkspaceState(currentState.workspaces[workspaceKey]);

    if (!isRecoverablePendingSession(workspaceState.session)) {
      return {
        state: workspaceState,
        recoveredPendingSession: false,
      };
    }

    const recoveredState = await updateWorkspaceState(workspaceRoot, (state: WorkspaceSyncState) => ({
      ...state,
      session: null,
      lastError: {
        code: 'PENDING_SESSION_RECOVERED',
        message: '',
        at: Date.now(),
      },
    }));

    return {
      state: recoveredState,
      recoveredPendingSession: true,
    };
  },

  async beginSession(
    workspaceRoot: string,
    trigger: 'manual' | 'timer' | 'save',
  ): Promise<SyncSession> {
    const session: SyncSession = {
      id: crypto.randomUUID(),
      status: 'syncing',
      trigger,
      startedAt: Date.now(),
    };

    await updateWorkspaceState(workspaceRoot, (state: WorkspaceSyncState) => ({
      ...state,
      session,
    }));

    return session;
  },

  async finishSession(
    workspaceRoot: string,
    payload: Partial<Pick<WorkspaceSyncState, 'baselineManifest' | 'baselineNodesContent' | 'lastSyncedAt' | 'lastSummary' | 'lastError'>>,
  ): Promise<WorkspaceSyncState> {
    return await updateWorkspaceState(workspaceRoot, (state: WorkspaceSyncState) => ({
      ...state,
      baselineManifest: payload.baselineManifest ?? state.baselineManifest,
      baselineNodesContent: payload.baselineNodesContent ?? state.baselineNodesContent,
      lastSyncedAt: payload.lastSyncedAt ?? state.lastSyncedAt,
      lastSummary: payload.lastSummary ?? state.lastSummary,
      lastError: payload.lastError ?? null,
      session: null,
    }));
  },

  async clearWorkspaceState(workspaceRoot: string): Promise<void> {
    const currentState = await readStateFile();
    const workspaceKey = getWorkspaceKey(workspaceRoot);

    if (!(workspaceKey in currentState.workspaces)) {
      return;
    }

    delete currentState.workspaces[workspaceKey];
    await writeStateFile(currentState);
  },
};
