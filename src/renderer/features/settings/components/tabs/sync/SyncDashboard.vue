<template>
  <div class="settings-grid">
    <section class="setting-card">
      <div class="setting-copy">
        <p class="setting-label">{{ t('label.syncRemoteData') }}</p>
        <p class="setting-description">{{ t('text.syncRemoteData') }}</p>
      </div>
      <button
        type="button"
        class="startup-switch"
        :class="{ enabled: settingsStore.config.sync.enabled }"
        :disabled="isLicenseLocked"
        @click="toggleSyncEnabled"
      >
        <span class="startup-switch-track">
          <span class="startup-switch-thumb" />
        </span>
        <span class="startup-switch-text">
          {{ settingsStore.config.sync.enabled ? t('checkbox.status.enabled') : t('checkbox.status.disabled') }}
        </span>
      </button>
    </section>

    <div class="settings-row-grid">
      <section class="setting-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('label.syncAutoOnSave') }}</p>
          <p class="setting-description">{{ t('text.syncAutoOnSave') }}</p>
        </div>
        <button
          type="button"
          class="startup-switch"
          :class="{ enabled: settingsStore.config.sync.autoSyncOnSave }"
          :disabled="isSyncDisabled"
          @click="toggleAutoSyncOnSave"
        >
          <span class="startup-switch-track">
            <span class="startup-switch-thumb" />
          </span>
          <span class="startup-switch-text">
            {{ settingsStore.config.sync.autoSyncOnSave ? t('checkbox.status.enabled') : t('checkbox.status.disabled') }}
          </span>
        </button>
      </section>

      <section class="setting-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('label.syncInterval') }}</p>
          <p class="setting-description">{{ t('text.syncInterval') }}</p>
        </div>
        <label class="select-shell" :class="{ disabled: isSyncDisabled }">
          <select
            class="settings-select"
            :value="settingsStore.config.sync.intervalMinutes"
            :disabled="isSyncDisabled"
            @change="handleIntervalChange"
          >
            <option v-for="option in SYNC_INTERVAL_OPTIONS" :key="option.value" :value="option.value">
              {{ t(option.labelKey) }}
            </option>
          </select>
        </label>
      </section>
    </div>

    <section class="setting-card sync-provider-card">
      <div class="setting-copy sync-provider-copy">
        <p class="setting-label">{{ t('label.syncTarget') }}</p>
        <p class="setting-description">{{ selectedProviderDescription }}</p>
      </div>
      <div class="settings-mode-control sync-provider-control">
        <div class="sync-provider-segmented" role="radiogroup" :aria-label="t('label.syncTarget')">
          <button
            type="button"
            class="sync-provider-option"
            :class="{ active: selectedProvider === SYNC_PROVIDERS.WEBDAV }"
            role="radio"
            :aria-checked="selectedProvider === SYNC_PROVIDERS.WEBDAV"
            :disabled="isProviderConfigDisabled"
            @click="handleProviderSelect(SYNC_PROVIDERS.WEBDAV)"
          >
            <IconServer :size="16" />
            <span>{{ t('option.sync.webdav') }}</span>
          </button>
          <button
            type="button"
            class="sync-provider-option"
            :class="{ active: selectedProvider === SYNC_PROVIDERS.OSS_S3 }"
            role="radio"
            :aria-checked="selectedProvider === SYNC_PROVIDERS.OSS_S3"
            :disabled="isProviderConfigDisabled"
            @click="handleProviderSelect(SYNC_PROVIDERS.OSS_S3)"
          >
            <IconDatabase :size="16" />
            <span>{{ t('option.sync.oss') }}</span>
          </button>
        </div>

        <button
          type="button"
          class="settings-nav-btn"
          :title="selectedProviderSettingLabel"
          :aria-label="selectedProviderSettingLabel"
          :disabled="isProviderConfigDisabled"
          @click="handleEditSelectedProvider"
        >
          <IconPencil :size="16" />
        </button>
        <button
          type="button"
          class="settings-nav-btn sync-provider-reset-btn"
          :title="selectedProviderResetLabel"
          :aria-label="selectedProviderResetLabel"
          :disabled="isProviderConfigDisabled"
          @click="handleClearSelectedProvider"
        >
          <IconTrash :size="16" />
        </button>
      </div>
    </section>

    <section class="setting-card sync-status-card">
      <div class="sync-status-main-row">
        <div class="status-info-group">
          <p class="setting-label">{{ t('label.syncStatus') }}</p>
          <span class="sync-status-pill" :class="syncStatusToneClass">{{ statusLabel }}</span>
          <span v-if="formattedLastSynced" class="setting-meta sync-status-time">
            {{ t('label.lastSynced') }}: {{ formattedLastSynced }}
          </span>
        </div>
        <div class="status-actions">
          <button
            type="button"
            class="action-button primary"
            :disabled="isLicenseLocked || syncStore.isSyncing || !settingsStore.config.sync.enabled"
            @click="handleSyncNow"
          >
            <span v-if="syncStore.isSyncing" class="spinner small"></span>
            {{ syncStore.isSyncing ? t('button.syncing') : t('button.syncNow') }}
          </button>
        </div>
      </div>
    </section>

    <section class="setting-card sync-summary-card">
      <div class="setting-copy">
        <p class="setting-label">{{ t('label.syncSummary') }}</p>
      </div>
      <div v-if="!hasSyncSummaryDetails" class="sync-summary-empty">
        <span class="summary-activity-dot idle" aria-hidden="true"></span>
        <span>{{ t('sync.summary.noChanges') }}</span>
      </div>
      <div v-else class="summary-activity-list" :aria-label="t('label.syncSummary')">
        <span v-if="syncSummaryCounts.uploaded > 0" class="summary-activity-item uploaded">
          <span class="summary-activity-dot" aria-hidden="true"></span>
          <span>{{ t('sync.summary.uploaded', { count: syncSummaryCounts.uploaded }) }}</span>
        </span>
        <span v-if="syncSummaryCounts.downloaded > 0" class="summary-activity-item downloaded">
          <span class="summary-activity-dot" aria-hidden="true"></span>
          <span>{{ t('sync.summary.downloaded', { count: syncSummaryCounts.downloaded }) }}</span>
        </span>
        <span v-if="syncSummaryCounts.merged > 0" class="summary-activity-item merged">
          <span class="summary-activity-dot" aria-hidden="true"></span>
          <span>{{ t('sync.summary.merged', { count: syncSummaryCounts.merged }) }}</span>
        </span>
        <span v-if="syncSummaryCounts.conflicts > 0" class="summary-activity-item conflicts">
          <span class="summary-activity-dot" aria-hidden="true"></span>
          <span>{{ t('sync.summary.conflicts', { count: syncSummaryCounts.conflicts }) }}</span>
        </span>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { IconServer, IconPencil, IconTrash, IconDatabase } from '@tabler/icons-vue';
import { SYNC_PROVIDERS, type SyncProvider } from '@shared/sync.constants';
import { useSettingsStore } from '../../../store/settings.store';
import { SYNC_INTERVAL_OPTIONS, SYNC_TRIGGERS, syncService, useSyncPresentation, useSyncStore } from '@renderer/features/sync';
import { useWorkspaceStore } from '@renderer/features/workspace/store/workspace.store';
import { securityService, normalizeSecurityError } from '@renderer/features/security';
import { settingsService } from '../../../services/settings.service';
import { systemDialog } from '../../../services/system-dialog.service';
import { useLicenseGate } from '@renderer/features/license';

const emit = defineEmits<{
  (e: 'editProvider', provider: SyncProvider): void;
}>();

const { t } = useI18n();
const settingsStore = useSettingsStore();
const syncStore = useSyncStore();
const workspaceStore = useWorkspaceStore();
const syncLicenseGate = useLicenseGate('sync');
const isLicenseLocked = computed(() => !syncLicenseGate.allowed.value);

const isConfigReady = computed(() => syncService.isConfigReady(settingsStore.config.sync));
const { statusLabel, statusToneClass, formattedLastSynced } = useSyncPresentation();
const syncStatusToneClass = computed(() => statusToneClass.value);
const syncSummaryCounts = computed(() => {
  const summary = syncStore.lastSummary;
  return {
    uploaded: summary?.uploaded ?? 0,
    downloaded: summary?.downloaded ?? 0,
    merged: summary?.merged ?? 0,
    conflicts: summary?.conflicts ?? 0,
  };
});
const hasSyncSummaryDetails = computed(() =>
  syncSummaryCounts.value.uploaded > 0 ||
  syncSummaryCounts.value.downloaded > 0 ||
  syncSummaryCounts.value.merged > 0 ||
  syncSummaryCounts.value.conflicts > 0
);

const isSyncDisabled = computed(() => isLicenseLocked.value || !settingsStore.config.sync.enabled);
const isProviderConfigDisabled = computed(() => isLicenseLocked.value);
const selectedProvider = computed<SyncProvider>(() =>
  settingsStore.config.sync.provider === SYNC_PROVIDERS.OSS_S3 ? SYNC_PROVIDERS.OSS_S3 : SYNC_PROVIDERS.WEBDAV
);
const selectedProviderLabel = computed(() =>
  selectedProvider.value === SYNC_PROVIDERS.WEBDAV ? t('option.sync.webdav') : t('option.sync.oss')
);
const selectedProviderDescription = computed(() =>
  selectedProvider.value === SYNC_PROVIDERS.WEBDAV ? t('text.webdavUrl') : t('text.ossEndpoint')
);
const selectedProviderSettingLabel = computed(() => `${selectedProviderLabel.value} ${t('common.setting')}`);
const selectedProviderResetLabel = computed(() => `${selectedProviderLabel.value} ${t('common.reset')}`);

const requestLicenseAccessIfNeeded = (): boolean => {
  if (!isLicenseLocked.value) {
    return false;
  }

  syncLicenseGate.requestAccess();
  return true;
};

async function showSyncDialog(message: string, type: 'error' | 'warning' = 'warning'): Promise<void> {
  if (type === 'error') {
    await systemDialog.error({
      title: t('pref.pane.sync'),
      message,
    });
    return;
  }
  await systemDialog.warning({
    title: t('pref.pane.sync'),
    message,
  });
}

const toggleSyncEnabled = async () => {
  if (requestLicenseAccessIfNeeded()) {
    return;
  }

  const nextEnabled = !settingsStore.config.sync.enabled;
  if (!nextEnabled) {
    await settingsStore.updateSyncSetting('enabled', false);
    return;
  }

  await settingsStore.updateSyncSetting('enabled', true);
};

const toggleAutoSyncOnSave = () => {
  if (requestLicenseAccessIfNeeded()) {
    return;
  }

  if (isSyncDisabled.value) {
    return;
  }

  settingsStore.updateSyncSetting('autoSyncOnSave', !settingsStore.config.sync.autoSyncOnSave);
};

const handleIntervalChange = (event: Event) => {
  if (requestLicenseAccessIfNeeded()) {
    return;
  }

  if (isSyncDisabled.value) {
    return;
  }

  settingsStore.updateSyncSetting('intervalMinutes', Number((event.target as HTMLSelectElement).value));
};

const handleProviderSelect = async (provider: SyncProvider) => {
  if (requestLicenseAccessIfNeeded()) {
    return;
  }

  if (isProviderConfigDisabled.value) {
    return;
  }

  await settingsStore.updateSyncSetting('provider', provider);
};

function resolveSyncReadinessMessage(code: string, fallbackMessage: string): string {
  const keyByCode: Record<string, string> = {
    KEY_SLOTS_RESTORED: 'sync.notice.keySlotsRestored',
    WRONG_PASSWORD: 'e2ee.error.wrongPassword',
    KEY_SLOTS_CORRUPTED: 'e2ee.error.keySlotsCorrupted',
    RECOVERY_KEY_INVALID: 'e2ee.error.recoveryKeyInvalid',
    SETUP_FAILED: 'e2ee.error.setupFailed',
    DEK_NOT_UNLOCKED: 'e2ee.error.dekNotUnlocked',
    MASTER_PASSWORD_REQUIRED: 'e2ee.error.masterPasswordRequired',
  };

  const key = keyByCode[code];
  return key ? t(key) : fallbackMessage;
}

function hasSyncTargetInput(): boolean {
  const syncConfig = syncService.normalizeSyncConfig(settingsStore.config.sync);

  if (syncConfig.provider === SYNC_PROVIDERS.WEBDAV) {
    return Boolean(
      syncConfig.webdav.url ||
      syncConfig.webdav.username ||
      syncConfig.webdav.password
    );
  }

  return Boolean(
    syncConfig.ossS3.endpoint ||
    syncConfig.ossS3.region ||
    syncConfig.ossS3.bucket ||
    syncConfig.ossS3.accessKeyId ||
    syncConfig.ossS3.secretAccessKey
  );
}

async function tryRestoreKeySlotsFromSyncTarget(): Promise<boolean> {
  if (!isConfigReady.value && !hasSyncTargetInput()) {
    return false;
  }

  const restoreResult = await syncService.restoreRemoteKeySlots(settingsStore.config.sync);
  if (!restoreResult.restored) {
    return false;
  }

  await showSyncDialog(t('sync.notice.keySlotsRestored'));
  return true;
}

async function ensureMasterPasswordConfiguredForSync(): Promise<boolean> {
  const restored = await tryRestoreKeySlotsFromSyncTarget();
  if (restored) {
    return false;
  }

  await showSyncDialog(t('e2ee.error.masterPasswordRequired'));
  return false;
}

async function ensureMasterPasswordUnlockedForSync(): Promise<boolean> {
  await showSyncDialog(t('e2ee.error.dekNotUnlocked'));
  return false;
}

async function ensureE2eeReadyForSync(): Promise<boolean> {
  if (!securityService.isAvailable()) {
    return true;
  }

  try {
    const status = await securityService.getStatus();

    if (!status.hasKeySlots) {
      return await ensureMasterPasswordConfiguredForSync();
    }

    if (!status.isUnlocked) {
      return await ensureMasterPasswordUnlockedForSync();
    }

    return true;
  } catch (error: unknown) {
    const normalized = normalizeSecurityError(error);
    await showSyncDialog(resolveSyncReadinessMessage(normalized.code, normalized.message));
    return false;
  }
}

const handleSyncNow = async () => {
  if (requestLicenseAccessIfNeeded()) {
    return;
  }

  if (!isConfigReady.value) {
    await showSyncDialog(t('sync.error.notConfigured'));
    return;
  }

  if (!(await ensureE2eeReadyForSync())) {
    return;
  }

  await workspaceStore.forceFlushAutoSave();
  const result = await syncStore.runSync(settingsStore.config.sync, SYNC_TRIGGERS.MANUAL);
  if (!result) {
    await showSyncDialog(syncStore.lastError?.message || t('sync.error.unknown'), 'error');
  }
};

const handleEditBtnClick = (provider: SyncProvider) => {
  if (requestLicenseAccessIfNeeded()) {
    return;
  }

  emit('editProvider', provider);
};

const handleEditSelectedProvider = () => {
  handleEditBtnClick(selectedProvider.value);
};

const handleClearBtnClick = async (provider: SyncProvider) => {
  if (requestLicenseAccessIfNeeded()) {
    return;
  }

  const providerName = provider === SYNC_PROVIDERS.WEBDAV ? t('option.sync.webdav') : t('option.sync.oss');
  const confirmed = await settingsService.confirmResetSyncProvider(providerName);
  if (confirmed) {
    await settingsStore.resetSyncProviderSetting(provider === SYNC_PROVIDERS.OSS_S3 ? 'ossS3' : 'webdav');
  }
};

const handleClearSelectedProvider = async () => {
  await handleClearBtnClick(selectedProvider.value);
};
</script>

<style scoped>
.sync-status-card {
  align-items: stretch;
}

.sync-status-main-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.status-info-group {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 10px;
  flex: 1;
  min-width: 0;
}

.status-info-group .setting-label {
  margin: 0;
  white-space: nowrap;
}

.sync-status-time {
  min-width: 0;
}

.status-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12px;
}

.sync-status-pill {
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 0.76rem;
  font-weight: 600;
  border: 1px solid transparent;
}

.setting-meta {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.is-idle {
  background: var(--status-success-bg);
  border-color: var(--status-success-border);
  color: var(--status-success-text);
}

.is-syncing {
  background: var(--status-info-bg);
  border-color: var(--status-info-border);
  color: var(--status-info-text);
}

.is-error {
  background: var(--status-danger-bg);
  border-color: var(--status-danger-border);
  color: var(--status-danger-text);
}

.sync-summary-card {
  align-items: center;
  gap: 12px;
}

.sync-summary-card .setting-copy {
  flex: 0 0 auto;
}

.sync-summary-card .summary-activity-list {
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.sync-summary-empty {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  margin-left: auto;
  text-align: right;
  color: var(--text-secondary);
  font-size: 0.8rem;
}

.summary-activity-item {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 28px;
  padding: 3px 9px;
  border: 1px solid var(--status-neutral-border);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--status-neutral-bg) 76%, var(--surface-raised));
  font-size: 0.78rem;
  font-weight: 500;
  line-height: 1.5;
  transition: background-color 0.16s ease, border-color 0.16s ease;
}

.summary-activity-item:hover {
  background: color-mix(in srgb, var(--status-neutral-bg) 84%, var(--surface-raised));
  border-color: color-mix(in srgb, var(--status-neutral-border) 100%, var(--border-strong));
}

.summary-activity-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: var(--status-neutral-text);
  box-shadow: 0 0 0 3px var(--status-neutral-bg);
  flex-shrink: 0;
}

.summary-activity-dot.idle {
  background: var(--status-success-text);
  box-shadow: 0 0 0 3px var(--status-success-bg);
}

.summary-activity-item.uploaded {
  color: var(--status-info-text);
  border-color: var(--status-info-border);
  background: color-mix(in srgb, var(--status-info-bg) 72%, var(--surface-raised));
}

.summary-activity-item.uploaded .summary-activity-dot {
  background: var(--status-info-text);
  box-shadow: 0 0 0 3px var(--status-info-bg);
}

.summary-activity-item.downloaded,
.summary-activity-item.merged {
  color: var(--status-success-text);
  border-color: var(--status-success-border);
  background: color-mix(in srgb, var(--status-success-bg) 72%, var(--surface-raised));
}

.summary-activity-item.downloaded .summary-activity-dot,
.summary-activity-item.merged .summary-activity-dot {
  background: var(--status-success-text);
  box-shadow: 0 0 0 3px var(--status-success-bg);
}

.summary-activity-item.conflicts {
  color: var(--status-warning-text);
  border-color: var(--status-warning-border);
  background: color-mix(in srgb, var(--status-warning-bg) 72%, var(--surface-raised));
}

.summary-activity-item.conflicts .summary-activity-dot {
  background: var(--status-warning-text);
  box-shadow: 0 0 0 3px var(--status-warning-bg);
}

.sync-provider-card {
  align-items: center;
}

.sync-provider-copy {
  flex: 1 1 auto;
}

.sync-provider-control {
  flex: 0 0 auto;
  min-width: 0;
}

.sync-provider-segmented {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-height: 32px;
  padding: 2px;
  border: 1px solid var(--border-muted);
  border-radius: var(--radius-md);
  background: var(--surface-raised);
}

.sync-provider-option {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 28px;
  padding: 0 10px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.84rem;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 0.16s ease, color 0.16s ease, opacity 0.16s ease;
}

.sync-provider-option.active {
  background: var(--surface-selected);
  color: var(--text-primary);
  box-shadow: var(--shadow-soft);
}

.sync-provider-option:hover:not(:disabled) {
  color: var(--accent-hover);
  background: color-mix(in srgb, var(--accent) 7%, var(--surface-raised));
}

.sync-provider-option:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--focus-ring);
}

.sync-provider-option:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.sync-provider-option svg,
.settings-nav-btn svg {
  flex-shrink: 0;
}

.sync-provider-reset-btn:hover:not(:disabled) {
  background: var(--button-danger-soft);
  border-color: var(--status-danger-border);
  color: var(--status-danger-text);
}

.settings-nav-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--focus-ring);
}

@media (max-width: 960px) {
  .sync-provider-card {
    flex-direction: column;
    align-items: stretch;
  }

  .sync-provider-control {
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .sync-status-main-row {
    flex-direction: column;
    align-items: stretch;
  }

  .status-actions {
    justify-content: flex-start;
  }

  .sync-summary-card .summary-activity-list {
    justify-content: flex-start;
  }

  .sync-summary-empty {
    margin-left: 0;
    text-align: left;
  }
}

@media (max-width: 720px) {
  .sync-provider-control {
    align-items: stretch;
    flex-wrap: wrap;
    justify-content: flex-start;
  }

  .sync-provider-segmented {
    width: 100%;
  }

  .sync-provider-option {
    flex: 1;
    min-width: 0;
  }
}
</style>
