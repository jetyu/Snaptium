import { defineStore } from 'pinia';
import type { SyncSummary } from '@renderer/core/bridge/electronApi';
import type { SyncSettings } from '@renderer/features/settings/store/settings.store';
import { useWorkspaceStore } from '@renderer/features/workspace/store/workspace.store';
import { SYNC_STATUS } from '../constants/sync.constants';
import { normalizeSyncError, syncService, type SyncRunResult, type SyncTrigger } from '../services/sync.service';

let activeSyncPromise: Promise<SyncRunResult | null> | null = null;
let queuedSyncRequest: { config: SyncSettings; trigger: SyncTrigger } | null = null;

async function executeQueuedSync(store: ReturnType<typeof useSyncStore>, request: { config: SyncSettings; trigger: SyncTrigger }) {
  let nextRequest: { config: SyncSettings; trigger: SyncTrigger } | null = request;
  let lastResult: SyncRunResult | null = null;

  while (nextRequest) {
    activeSyncPromise = store.executeSync(nextRequest.config, nextRequest.trigger);
    lastResult = await activeSyncPromise;
    activeSyncPromise = null;
    nextRequest = queuedSyncRequest;
    queuedSyncRequest = null;
  }

  return lastResult;
}

export const useSyncStore = defineStore('sync', {
  state: () => ({
    status: SYNC_STATUS.IDLE as 'idle' | 'syncing' | 'error',
    isTestingConnection: false,
    lastSyncedAt: null as number | null,
    lastSummary: null as SyncSummary | null,
    lastError: null as { code: string; message: string; at?: number } | null,
    recoveredPendingSession: false,
    initialized: false,
  }),

  getters: {
    isSyncing: (state) => state.status === SYNC_STATUS.SYNCING,
  },

  actions: {
    hydrateFromSettings(syncConfig: SyncSettings) {
      if (Number.isFinite(syncConfig.lastSyncedAt) && syncConfig.lastSyncedAt !== null) {
        this.lastSyncedAt = syncConfig.lastSyncedAt;
      }
    },

    async initialize(syncConfig: SyncSettings) {
      this.hydrateFromSettings(syncConfig);

      if (!syncService.isAvailable()) {
        this.initialized = true;
        return;
      }

      const snapshot = await syncService.getStatus();
      this.lastSyncedAt = snapshot.lastSyncedAt ?? syncConfig.lastSyncedAt ?? this.lastSyncedAt;
      this.lastSummary = snapshot.lastSummary;
      this.lastError = snapshot.lastError;
      this.recoveredPendingSession = snapshot.recoveredPendingSession;
      this.status = snapshot.lastError ? SYNC_STATUS.ERROR : SYNC_STATUS.IDLE;
      this.initialized = true;
    },

    async testConnection(syncConfig: SyncSettings): Promise<{ success: boolean; message?: string }> {
      this.isTestingConnection = true;
      try {
        const result = await syncService.testConnection(syncConfig);
        if (result.success) {
          return { success: true };
        }

        return {
          success: false,
          message: result.message,
        };
      } catch (error) {
        return {
          success: false,
          message: normalizeSyncError(error).message,
        };
      } finally {
        this.isTestingConnection = false;
      }
    },

    async runSync(syncConfig: SyncSettings, trigger: SyncTrigger = 'manual') {
      const request = {
        config: syncService.normalizeSyncConfig(syncConfig),
        trigger,
      };

      if (activeSyncPromise) {
        queuedSyncRequest = request;
        return null;
      }

      return await executeQueuedSync(this, request);
    },

    async executeSync(syncConfig: SyncSettings, trigger: SyncTrigger): Promise<SyncRunResult | null> {
      this.status = SYNC_STATUS.SYNCING;

      try {
        const result = await syncService.run(syncConfig, trigger);
        const workspaceStore = useWorkspaceStore();
        await workspaceStore.initializeWorkspace(true);
        this.lastSyncedAt = result.syncedAt ?? this.lastSyncedAt;
        this.lastSummary = result.summary ?? this.lastSummary;
        this.lastError = null;
        this.recoveredPendingSession = result.recoveredPendingSession;
        this.status = SYNC_STATUS.IDLE;
        return result;
      } catch (error) {
        this.lastError = normalizeSyncError(error);
        this.status = SYNC_STATUS.ERROR;
        return null;
      }
    },
  },
});