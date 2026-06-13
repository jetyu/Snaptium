<template>
  <div class="software-update-settings">
    <h3 class="panel-title">{{ t('label.softwareAutoUpdate') }}</h3>

    <div class="settings-grid">
      <section class="setting-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('label.softwareAutoUpdate') }}</p>
          <p class="setting-description">{{ t('text.softwareAutoUpdate') }}</p>
        </div>
        <button
          type="button"
          class="startup-switch"
          :class="{ enabled: settingsStore.config.autoCheckUpdates }"
          :aria-pressed="settingsStore.config.autoCheckUpdates"
          @click="handleAutoUpdateToggle"
        >
          <span class="startup-switch-track">
            <span class="startup-switch-thumb" />
          </span>
          <span class="startup-switch-text">
            {{ settingsStore.config.autoCheckUpdates ? t('checkbox.status.enabled') : t('checkbox.status.disabled') }}
          </span>
        </button>
      </section>

      <div class="settings-row-grid">
        <section class="setting-card">
          <div class="setting-copy">
            <p class="setting-label">{{ t('label.updateCheckInterval') }}</p>
            <p class="setting-description">{{ t('text.updateCheckInterval') }}</p>
          </div>
          <div class="number-input-container">
            <input
              type="number"
              class="settings-input number-input"
              :value="updateIntervalHours"
              min="1"
              max="168"
              :disabled="!settingsStore.config.autoCheckUpdates"
              @change="handleIntervalChange"
            />
          </div>
        </section>

        <section class="setting-card">
          <div class="setting-copy">
            <p class="setting-label">{{ t('label.updateChannel') }}</p>
            <p class="setting-description">{{ t('text.updateChannel') }}</p>
          </div>
          <label class="select-shell">
            <select class="settings-select" :value="settingsStore.config.updateChannel" @change="handleChannelChange">
              <option v-for="option in channelOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </label>
        </section>
      </div>

      <section class="setting-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('label.currentVersion') }}</p>
          <div class="update-version-stack">
            <span class="update-version-value">v{{ currentVersion }}</span>
          </div>
        </div>
        <button
          type="button"
          class="action-button"
          :disabled="isChecking || isDownloading"
          @click="handleCheckForUpdates"
        >
          {{ isChecking ? t('button.checkingForUpdates') : t('menu.help.update') }}
        </button>
      </section>

      <section
        class="setting-card update-state-card"
        :class="{ 'vertical-layout': isDownloadingState, 'is-downloading': isDownloadingState }"
      >
        <div class="setting-copy update-state-copy">
          <p class="setting-label">{{ updateStateTitle }}</p>
          <span class="update-state-message" :class="updateStateToneClass">
            {{ updateStateMessage }}
          </span>

          <div v-if="isDownloadingState" class="update-progress">
            <div class="update-progress-summary">
              <span class="update-progress-percent">{{ progressPercent }}%</span>
            </div>
            <div
              class="update-progress-track"
              role="progressbar"
              :aria-valuemin="0"
              :aria-valuemax="100"
              :aria-valuenow="progressPercent"
              :aria-valuetext="downloadProgressSummary"
            >
              <div class="update-progress-fill" :style="{ width: `${progressPercent}%` }" />
            </div>
          </div>
        </div>
        <div v-if="showAvailableUpdateActions || showInstallActions || showRetryAction" class="update-actions">
          <button v-if="showAvailableUpdateActions" type="button" class="action-button" @click="handleDownloadUpdate">
            {{ t('updater.download') }}
          </button>
          <button
            v-if="showAvailableUpdateActions"
            type="button"
            class="action-button secondary"
            @click="handleDismissAvailableUpdate"
          >
            {{ t('updater.later') }}
          </button>
          <button v-if="showInstallActions" type="button" class="action-button" @click="handleInstallUpdate">
            {{ t('updater.installNow') }}
          </button>
          <button v-if="showInstallActions" type="button" class="action-button secondary" @click="handleDismissInstall">
            {{ t('updater.installLater') }}
          </button>
          <button v-if="showRetryAction" type="button" class="action-button secondary" @click="handleRetryUpdate">
            {{ t('updater.retry') }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { normalizeUpdateChannel, type UpdateChannel } from '@shared/updater.constants';
import { useUpdaterStore } from '@renderer/features/updater';
import { useSettingsStore } from '../../store/settings.store';

const { t } = useI18n();
const settingsStore = useSettingsStore();
const updaterStore = useUpdaterStore();
const {
  currentVersion,
  isChecking,
  isDownloading,
  updateAvailable,
  updateInfo,
  downloadProgress,
  error,
  updatePanelState,
  showAvailableUpdateActions,
  showInstallActions,
} = storeToRefs(updaterStore);

const channelOptions = computed(() => [
  { value: 'stable' as UpdateChannel, label: t('option.updateChannel.stable') },
  { value: 'beta' as UpdateChannel, label: t('option.updateChannel.beta') },
  { value: 'dev' as UpdateChannel, label: t('option.updateChannel.dev') },
]);

const updateIntervalHours = computed(() => Math.round(settingsStore.config.updateCheckInterval / (60 * 60 * 1000)));
const progressPercent = computed(() => Math.min(100, Math.max(0, Math.round(downloadProgress.value.percent || 0))));
const isDownloadingState = computed(() => updatePanelState.value === 'downloading');
const showRetryAction = computed(() => Boolean(error.value) && !isChecking.value && !isDownloading.value);

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** unitIndex;
  const digits = unitIndex === 0 || value >= 10 ? 0 : 1;

  return `${value.toFixed(digits)} ${units[unitIndex]}`;
}

const downloadProgressSummary = computed(() => {
  const transferred = formatBytes(downloadProgress.value.transferred);
  const total = downloadProgress.value.total > 0 ? formatBytes(downloadProgress.value.total) : '';
  const sizeText = total ? `${transferred} / ${total}` : transferred;
  const speed = downloadProgress.value.bytesPerSecond > 0 ? formatBytes(downloadProgress.value.bytesPerSecond) : '';

  if (speed) {
    return `${t('updater.downloaded')} ${sizeText} · ${t('updater.downloadSpeed')} ${speed}/s`;
  }

  return `${t('updater.downloaded')} ${sizeText}`;
});

const updateStateTitle = computed(() => {
  switch (updatePanelState.value) {
    case 'checking':
      return t('button.checkingForUpdates');
    case 'available':
      return t('updater.newVersionAvailable');
    case 'downloading':
      return t('updater.downloadingUpdate');
    case 'ready-to-install':
      return t('updater.readyToInstall');
    case 'error':
      return t('updater.updateError');
    case 'up-to-date':
      return t('updater.upToDate');
    case 'idle':
    default:
      return t('updater.waitingToCheck');
  }
});
const updateStateMessage = computed(() => {
  switch (updatePanelState.value) {
    case 'checking':
      return t('updater.checkingMessage');
    case 'available':
      return updateInfo.value
        ? t('updater.newVersionMessage', { version: updateInfo.value.version })
        : t('updater.newVersionAvailable');
    case 'downloading':
      return downloadProgressSummary.value;
    case 'ready-to-install':
      return updateInfo.value
        ? t('updater.installMessage', { version: updateInfo.value.version })
        : t('updater.readyToInstall');
    case 'error':
      return error.value?.message ?? t('updater.unknownError');
    case 'up-to-date':
      return t('updater.upToDateMessage');
    case 'idle':
    default:
      return t('updater.waitingToCheckMessage');
  }
});
const updateStateToneClass = computed(() => ({
  'is-success': updatePanelState.value === 'up-to-date',
  'is-error': updatePanelState.value === 'error',
  'is-info': updatePanelState.value === 'available' || updatePanelState.value === 'ready-to-install' || updatePanelState.value === 'downloading',
}));

async function syncUpdaterConfig(): Promise<void> {
  await updaterStore.updateConfig({
    autoCheckUpdates: settingsStore.config.autoCheckUpdates,
    updateCheckInterval: settingsStore.config.updateCheckInterval,
    updateChannel: settingsStore.config.updateChannel,
  });
}

const handleCheckForUpdates = async () => {
  await updaterStore.checkForUpdates(false);
};

const handleDownloadUpdate = async () => {
  await updaterStore.downloadUpdate();
};

const handleDismissAvailableUpdate = () => {
  updaterStore.dismissAvailableUpdateActions();
};

const handleInstallUpdate = async () => {
  await updaterStore.installUpdate();
};

const handleDismissInstall = () => {
  updaterStore.dismissInstallActions();
};

const handleRetryUpdate = async () => {
  if (error.value?.code === 'DOWNLOAD_FAILED' && updateAvailable.value) {
    await updaterStore.downloadUpdate();
    return;
  }

  await updaterStore.checkForUpdates(false);
};

const handleAutoUpdateToggle = async () => {
  const nextValue = !settingsStore.config.autoCheckUpdates;
  await settingsStore.updateSetting('autoCheckUpdates', nextValue);
  await syncUpdaterConfig();
};

const handleIntervalChange = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const nextHours = Number.parseInt(target.value, 10);
  if (Number.isNaN(nextHours) || nextHours <= 0) {
    return;
  }

  await settingsStore.updateSetting('updateCheckInterval', nextHours * 60 * 60 * 1000);
  await syncUpdaterConfig();
};

const handleChannelChange = async (event: Event) => {
  const target = event.target as HTMLSelectElement;
  const nextChannel = normalizeUpdateChannel(target.value);
  if (nextChannel === settingsStore.config.updateChannel) {
    return;
  }

  await settingsStore.updateSetting('updateChannel', nextChannel);
  updaterStore.clearDiscoveredUpdate();
  await syncUpdaterConfig();
};
</script>

<style scoped>
.update-version-stack {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.update-version-value {
  font-size: 0.95rem;
  font-weight: 600;
  color: #111827;
}

.update-state-card {
  align-items: stretch;
  min-height: 92px;
}

.update-state-card.is-downloading {
  border-color: color-mix(in srgb, #0f6cbd 18%, #e7eaf0);
  background: linear-gradient(180deg, color-mix(in srgb, #0f6cbd 5%, #fbfbfc), #fbfbfc);
}

.update-state-card.vertical-layout {
  align-items: stretch;
  gap: 0.85rem;
}

.update-state-copy {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.15rem;
  width: 100%;
}

.update-state-message {
  color: #5f6b7a;
  font-size: 0.82rem;
  line-height: 1.45;
  word-break: break-word;
}

.update-state-message.is-info {
  color: #2563eb;
}

.update-state-message.is-success {
  color: #15803d;
}

.update-state-message.is-error {
  color: #dc2626;
}

.update-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.update-progress {
  width: 100%;
  margin-top: 0.55rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.update-progress-summary {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.update-progress-percent {
  display: inline-flex;
  align-items: center;
  padding: 0.16rem 0.55rem;
  border-radius: 999px;
  background: color-mix(in srgb, #0f6cbd 12%, #ffffff);
  color: #0f6cbd;
  font-size: 0.78rem;
  font-weight: 700;
  line-height: 1.35;
}

.update-progress-track {
  height: 8px;
  margin: 0;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in srgb, #0f6cbd 12%, #e5e7eb);
}

.update-progress-fill {
  height: 100%;
  border-radius: inherit;
  background: #0f6cbd;
  transition: width 0.2s ease;
}

@media (max-width: 720px) {
  .update-actions {
    justify-content: flex-start;
  }

  .update-progress-summary {
    justify-content: flex-start;
  }
}
</style>

