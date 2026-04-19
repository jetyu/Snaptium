import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useSettingsStore } from '@renderer/features/settings';
import { useSyncStore } from '../store/sync.store';

export function useSyncPresentation() {
  const { t } = useI18n();
  const settingsStore = useSettingsStore();
  const syncStore = useSyncStore();

  const statusLabel = computed(() => t(`syncStatus.${syncStore.status}`));

  const statusToneClass = computed(() => {
    if (syncStore.lastError?.message || syncStore.status === 'error') {
      return 'is-error';
    }
    if (syncStore.isSyncing || syncStore.status === 'syncing') {
      return 'is-syncing';
    }
    return 'is-idle';
  });

  const summaryItems = computed(() => {
    if (!syncStore.lastSummary) {
      return [t('sync.summary.noChanges')];
    }

    const items = [
      { count: syncStore.lastSummary.uploaded, label: t('sync.summary.uploaded', { count: syncStore.lastSummary.uploaded }) },
      { count: syncStore.lastSummary.downloaded, label: t('sync.summary.downloaded', { count: syncStore.lastSummary.downloaded }) },
      { count: syncStore.lastSummary.merged, label: t('sync.summary.merged', { count: syncStore.lastSummary.merged }) },
      { count: syncStore.lastSummary.conflicts, label: t('sync.summary.conflicts', { count: syncStore.lastSummary.conflicts }) },
    ];

    const activeItems = items.filter(item => item.count > 0).map(item => item.label);
    return activeItems.length > 0 ? activeItems : [t('sync.summary.noChanges')];
  });

  const formattedLastSynced = computed(() => {
    const lastSyncedAt = syncStore.lastSyncedAt ?? settingsStore.config.sync.lastSyncedAt;
    if (!lastSyncedAt) {
      return '';
    }

    return new Intl.DateTimeFormat(settingsStore.config.language, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(lastSyncedAt);
  });

  return {
    statusLabel,
    statusToneClass,
    summaryItems,
    formattedLastSynced,
  };
}
