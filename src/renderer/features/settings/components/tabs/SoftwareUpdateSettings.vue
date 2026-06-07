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

      <section class="setting-card update-status-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('label.currentVersion') }}</p>
          <div class="update-version-stack">
            <span class="update-version-value">v{{ currentVersion }}</span>
            <span v-if="updateAvailable && updateInfo" class="update-version-note">
              {{ t('label.latestVersion') }}: v{{ updateInfo.version }}
            </span>
            <span v-if="isUpdateDownloaded && updateInfo" class="update-version-note">
              {{ t('updater.readyToInstall') }}
            </span>
            <span v-else-if="isDownloading" class="update-version-note">
              {{ t('updater.downloadingUpdate') }}
            </span>
            <span v-if="showNoUpdateResult" class="update-version-success">
              {{ t('updater.upToDate') }}
            </span>
            <span v-if="error" class="update-version-error">
              {{ error.message }}
            </span>
          </div>

          <div v-if="isDownloading" class="update-progress">
            <div class="update-progress-header">
              <span>{{ t('updater.progress') }}</span>
              <span>{{ progressPercent }}%</span>
            </div>
            <div class="update-progress-track">
              <div class="update-progress-fill" :style="{ width: `${progressPercent}%` }" />
            </div>
          </div>
        </div>
        <div class="update-actions">
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
          <button
            type="button"
            class="action-button"
            :disabled="isChecking || isDownloading"
            @click="handleCheckForUpdates"
          >
            {{ isChecking ? t('button.checkingForUpdates') : t('menu.help.update') }}
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
  isUpdateDownloaded,
  updateInfo,
  downloadProgress,
  error,
  showNoUpdateResult,
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
const showRetryAction = computed(() => Boolean(error.value) && !isChecking.value && !isDownloading.value);

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

.update-version-note {
  font-size: 0.78rem;
  color: #2563eb;
}

.update-version-error {
  font-size: 0.78rem;
  color: #dc2626;
}

.update-version-success {
  font-size: 0.78rem;
  color: #15803d;
}

.update-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.update-progress {
  width: min(100%, 460px);
  margin-top: 0.65rem;
}

.update-progress-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  color: #5f6b7a;
  font-size: 0.78rem;
}

.update-progress-track {
  height: 6px;
  margin: 0.35rem 0;
  overflow: hidden;
  border-radius: 999px;
  background: #e5e7eb;
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

  .update-progress-header {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.2rem;
  }
}
</style>
