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

    <section class="subtitle-settings-section">
      <p class="subtitle-settings-label">{{ t('label.syncTarget') }}</p>
      <div class="provider-grid">
        <div
          class="setting-card provider-card"
          :class="{ active: settingsStore.config.sync.provider === 'webdav', disabled: isProviderConfigDisabled }"
          @click="handleProviderSelect('webdav')"
        >
          <span v-if="settingsStore.config.sync.provider === 'webdav'" class="active-tag">{{ t('checkbox.status.enabled') }}</span>
          <div class="provider-icon webdav">
            <IconServer :size="24" />
          </div>
          <div class="provider-info">
            <div class="provider-header">
              <span class="provider-name">{{ t('option.sync.webdav') }}</span>
            </div>
            <p class="provider-desc">{{ t('text.webdavUrl') }}</p>
          </div>
          <div class="settings-card-actions provider-card-actions">
            <button
              class="action-icon-btn edit"
              @click.stop="handleEditBtnClick('webdav')"
              :title="t('common.edit')"
              :disabled="isProviderConfigDisabled"
            >
              <IconPencil :size="16" />
            </button>
            <button
              class="action-icon-btn clear"
              @click.stop="handleClearBtnClick('webdav')"
              :title="t('common.reset')"
              :disabled="isProviderConfigDisabled"
            >
              <IconTrash :size="16" />
            </button>
          </div>
        </div>

        <div
          class="setting-card provider-card"
          :class="{ active: settingsStore.config.sync.provider === 'oss-s3', disabled: isProviderConfigDisabled }"
          @click="handleProviderSelect('oss-s3')"
        >
          <span v-if="settingsStore.config.sync.provider === 'oss-s3'" class="active-tag">{{ t('checkbox.status.enabled') }}</span>
          <div class="provider-icon oss">
            <IconDatabase :size="24" />
          </div>
          <div class="provider-info">
            <div class="provider-header">
              <span class="provider-name">{{ t('option.sync.oss') }}</span>
            </div>
            <p class="provider-desc">{{ t('text.ossEndpoint') }}</p>
          </div>
          <div class="settings-card-actions provider-card-actions">
            <button
              class="action-icon-btn edit"
              @click.stop="handleEditBtnClick('oss-s3')"
              :title="t('common.edit')"
              :disabled="isProviderConfigDisabled"
            >
              <IconPencil :size="16" />
            </button>
            <button
              class="action-icon-btn clear"
              @click.stop="handleClearBtnClick('oss-s3')"
              :title="t('common.reset')"
              :disabled="isProviderConfigDisabled"
            >
              <IconTrash :size="16" />
            </button>
          </div>
        </div>
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
      <div class="summary-pills">
        <span v-for="item in summaryItems" :key="item" class="summary-pill">{{ item }}</span>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { IconServer, IconPencil, IconTrash, IconDatabase } from '@tabler/icons-vue';
import { useSettingsStore } from '../../../store/settings.store';
import { SYNC_INTERVAL_OPTIONS, SYNC_TRIGGERS, syncService, useSyncPresentation, useSyncStore } from '@renderer/features/sync';
import { useWorkspaceStore } from '@renderer/features/workspace/store/workspace.store';
import { securityService, normalizeSecurityError } from '@renderer/features/security';
import { settingsService } from '../../../services/settings.service';
import { systemDialog } from '../../../services/system-dialog.service';
import { useLicenseGate } from '@renderer/features/license';

const emit = defineEmits<{
  (e: 'editProvider', provider: 'webdav' | 'oss-s3'): void;
}>();

const { t } = useI18n();
const settingsStore = useSettingsStore();
const syncStore = useSyncStore();
const workspaceStore = useWorkspaceStore();
const syncLicenseGate = useLicenseGate('sync');
const isLicenseLocked = computed(() => !syncLicenseGate.allowed.value);

const isConfigReady = computed(() => syncService.isConfigReady(settingsStore.config.sync));
const { statusLabel, statusToneClass, summaryItems, formattedLastSynced } = useSyncPresentation();
const syncStatusToneClass = computed(() => statusToneClass.value);

const isSyncDisabled = computed(() => isLicenseLocked.value || !settingsStore.config.sync.enabled);
const isProviderConfigDisabled = computed(() => isLicenseLocked.value);

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

const handleProviderSelect = async (provider: 'webdav' | 'oss-s3') => {
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

  if (syncConfig.provider === 'webdav') {
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

const handleEditBtnClick = (provider: 'webdav' | 'oss-s3') => {
  if (requestLicenseAccessIfNeeded()) {
    return;
  }

  emit('editProvider', provider);
};

const handleClearBtnClick = async (provider: 'webdav' | 'oss-s3') => {
  if (requestLicenseAccessIfNeeded()) {
    return;
  }

  const providerName = provider === 'webdav' ? t('option.sync.webdav') : t('option.sync.oss');
  const confirmed = await settingsService.confirmResetSyncProvider(providerName);
  if (confirmed) {
    await settingsStore.resetSyncProviderSetting(provider === 'oss-s3' ? 'ossS3' : 'webdav');
  }
};
</script>

<style scoped>
.sync-status-card {
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 14px;
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
  gap: 12px;
  flex: 1;
}

.status-info-group .setting-label {
  margin: 0;
  white-space: nowrap;
}

.sync-status-time {
  margin-left: 8px;
}

.status-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12px;
}

.sync-status-pill {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.8rem;
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

.sync-summary-card .summary-pills {
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.summary-pill {
  background: var(--status-neutral-bg);
  border: 1px solid var(--status-neutral-border);
  padding: 2px 10px;
  border-radius: 6px;
  font-size: 0.8rem;
  color: var(--status-neutral-text);
  transition: all 0.2s ease;
}

.summary-pill:hover {
  background: color-mix(in srgb, var(--status-neutral-bg) 88%, var(--surface-raised));
  border-color: color-mix(in srgb, var(--status-neutral-border) 100%, var(--border-strong));
}

.provider-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.provider-card {
  position: relative;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 72px;
}

.provider-card:hover {
  border-color: color-mix(in srgb, var(--accent) 24%, var(--border-color));
  background: var(--surface-soft);
}

.provider-card.active {
  border-color: color-mix(in srgb, var(--accent) 42%, var(--border-color));
  background: var(--surface-selected);
}

.provider-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  flex-shrink: 0;
}

.provider-icon.oss,
.provider-icon.webdav {
  background: var(--status-info-bg);
  color: var(--status-info-text);
}

.provider-info {
  flex: 1;
  min-width: 0;
}

.provider-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2px;
}

.provider-name {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text-primary);
}

.active-tag {
  position: absolute;
  top: -1px;
  right: -1px;
  font-size: 0.65rem;
  font-weight: 700;
  background: var(--accent-solid);
  color: var(--accent-solid-text);
  padding: 3px 10px 4px;
  border-radius: 0 10px 0 10px;
  line-height: 1;
  z-index: 10;
  box-shadow: var(--shadow-soft);
}

.provider-desc {
  font-size: 0.8rem;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0;
}

.provider-card-actions {
  gap: 6px;
  flex-shrink: 0;
}

.action-icon-btn {
  background: var(--button-secondary-bg);
  border: none;
  border-radius: 6px;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--text-secondary);
}

.action-icon-btn:hover {
  background: var(--button-secondary-bg-hover);
  color: var(--text-primary);
}

.action-icon-btn.clear:hover {
  background: var(--button-danger-soft);
  color: var(--status-danger-text);
}

.provider-card.disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.provider-card.disabled:hover {
  box-shadow: none;
}

.provider-card.disabled .provider-card-actions button {
  opacity: 0.65;
  pointer-events: none;
}

.action-icon-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

@media (max-width: 960px) {
  .provider-grid {
    grid-template-columns: 1fr;
  }

  .sync-status-main-row {
    flex-direction: column;
    align-items: stretch;
  }

  .status-actions {
    justify-content: flex-start;
  }
}
</style>
