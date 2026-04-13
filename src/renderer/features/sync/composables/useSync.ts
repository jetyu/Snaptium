import { computed } from 'vue';
import { useSyncStore } from '../store/sync.store';

export function useSync() {
  const syncStore = useSyncStore();

  return {
    status: computed(() => syncStore.status),
    isSyncing: computed(() => syncStore.isSyncing),
    isTestingConnection: computed(() => syncStore.isTestingConnection),
    lastSyncedAt: computed(() => syncStore.lastSyncedAt),
    lastSummary: computed(() => syncStore.lastSummary),
    lastError: computed(() => syncStore.lastError),
    recoveredPendingSession: computed(() => syncStore.recoveredPendingSession),
    initialize: syncStore.initialize,
    testConnection: syncStore.testConnection,
    syncNow: syncStore.runSync,
  };
}