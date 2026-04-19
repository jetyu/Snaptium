import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import { app } from 'electron';
import { VFS_CONSTANTS } from '../../constants/vfs.constants.js';
import { SYNC_RUNTIME } from '../../../shared/sync.constants.js';

const STATE_FILE = 'sync-state.json';

function cloneWorkspaceState(state = {}) {
  return {
    baselineManifest: state.baselineManifest ?? null,
    baselineNodesContent: typeof state.baselineNodesContent === 'string' ? state.baselineNodesContent : null,
    lastSyncedAt: Number.isFinite(Number(state.lastSyncedAt)) ? Number(state.lastSyncedAt) : null,
    lastSummary: state.lastSummary ?? null,
    lastError: state.lastError ?? null,
    session: state.session ?? null,
  };
}

function getStateFilePath() {
  return path.join(app.getPath(VFS_CONSTANTS.USER_DATA), STATE_FILE);
}

function getWorkspaceKey(workspaceRoot) {
  return crypto.createHash('sha256').update(path.resolve(workspaceRoot)).digest('hex');
}

async function readStateFile() {
  const filePath = getStateFilePath();
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(content);
    return {
      version: Number(parsed?.version ?? 1),
      workspaces: typeof parsed?.workspaces === 'object' && parsed.workspaces !== null ? parsed.workspaces : {},
    };
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return { version: 1, workspaces: {} };
    }
    throw error;
  }
}

async function writeStateFile(state) {
  const filePath = getStateFilePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(state, null, 2), 'utf8');
}

function isRecoverablePendingSession(session) {
  if (!session || session.status !== 'syncing') {
    return false;
  }

  return Date.now() - Number(session.startedAt ?? 0) >= SYNC_RUNTIME.SESSION_STALE_MS;
}

async function updateWorkspaceState(workspaceRoot, updater) {
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
  async loadWorkspaceState(workspaceRoot) {
    const currentState = await readStateFile();
    const workspaceKey = getWorkspaceKey(workspaceRoot);
    const workspaceState = cloneWorkspaceState(currentState.workspaces[workspaceKey]);

    if (!isRecoverablePendingSession(workspaceState.session)) {
      return {
        state: workspaceState,
        recoveredPendingSession: false,
      };
    }

    const recoveredState = await updateWorkspaceState(workspaceRoot, (state) => ({
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

  async beginSession(workspaceRoot, trigger) {
    const session = {
      id: crypto.randomUUID(),
      status: 'syncing',
      trigger,
      startedAt: Date.now(),
    };

    await updateWorkspaceState(workspaceRoot, (state) => ({
      ...state,
      session,
    }));

    return session;
  },

  async finishSession(workspaceRoot, payload) {
    return await updateWorkspaceState(workspaceRoot, (state) => ({
      ...state,
      baselineManifest: payload.baselineManifest ?? state.baselineManifest,
      baselineNodesContent: payload.baselineNodesContent ?? state.baselineNodesContent,
      lastSyncedAt: payload.lastSyncedAt ?? state.lastSyncedAt,
      lastSummary: payload.lastSummary ?? state.lastSummary,
      lastError: payload.lastError ?? null,
      session: null,
    }));
  },
};