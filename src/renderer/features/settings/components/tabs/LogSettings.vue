<template>
  <div class="log-settings">
    <h3 class="panel-title">{{ t('pref.pane.log') }}</h3>

    <div class="settings-grid">
      <!-- Enable Logging Toggle -->
      <section class="setting-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('label.localLogs') }}</p>
          <p class="setting-description">{{ t('text.loggingEnabled') }}</p>
        </div>

        <button type="button" class="startup-switch" :class="{ enabled: settingsStore.config.loggingEnabled }"
          :aria-pressed="settingsStore.config.loggingEnabled" @click="handleLoggingToggle">
          <span class="startup-switch-track">
            <span class="startup-switch-thumb" />
          </span>
          <span class="startup-switch-text">
            {{ settingsStore.config.loggingEnabled ? t('checkbox.status.enabled') : t('checkbox.status.disabled') }}
          </span>
        </button>
      </section>

      <!-- Log Level Select -->
      <section class="setting-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('label.logLevel') }}</p>
          <p class="setting-description">{{ t('text.logLevelDesc') }}</p>
        </div>

        <label class="select-shell" :class="{ disabled: !settingsStore.config.loggingEnabled }">
          <select class="settings-select" :value="selectedLogLevel" @change="handleLogLevelChange"
            :disabled="!settingsStore.config.loggingEnabled">
            <option v-for="option in logLevelOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>
      </section>

      <section class="setting-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('label.logAutoClear') }}</p>
          <p class="setting-description">{{ t('text.logAutoClear') }}</p>
        </div>
        <label class="select-shell" :class="{ disabled: !settingsStore.config.loggingEnabled }">
          <select class="settings-select" :value="settingsStore.config.logAutoClearDays ?? 10"
            @change="handleLogAutoClearChange" :disabled="!settingsStore.config.loggingEnabled">
            <option :value="0">{{ t('option.logAutoClear.never') }}</option>
            <option :value="10">{{ t('option.logAutoClear.days10') }}</option>
            <option :value="20">{{ t('option.logAutoClear.days20') }}</option>
          </select>
        </label>
      </section>

      <!-- Open Log Directory -->
      <section class="setting-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('button.openLogFolder') }}</p>
          <p class="setting-description">{{ t('contextMenu.showInFolder') }}</p>
        </div>

        <button class="action-button" @click="handleOpenLogDir">
          {{ t('button.openLogFolder') }}
        </button>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { isDev } from '@renderer/config/env';
import { useI18n } from 'vue-i18n';
import { useSettingsStore } from '../../store/settings.store';

const LOG_AUTO_CLEAR_DAY_OPTIONS = [0, 10, 20];

const { t } = useI18n();
const settingsStore = useSettingsStore();

const forceDebugOption = computed(() => !isDev && settingsStore.config.logLevel === 'debug');

const logLevelOptions = computed(() => [
  ...((isDev || forceDebugOption.value) ? [{ value: 'debug', label: t('option.logLevel.Debug') }] : []),
  { value: 'info', label: t('option.logLevel.Info') },
  { value: 'warn', label: t('option.logLevel.Warn') },
  { value: 'error', label: t('option.logLevel.Error') },
]);

const selectedLogLevel = computed(() => settingsStore.config.logLevel);

const handleLoggingToggle = async () => {
  await settingsStore.updateSetting('loggingEnabled', !settingsStore.config.loggingEnabled);
};

const handleLogLevelChange = async (event: Event) => {
  const target = event.target as HTMLSelectElement;
  if (!logLevelOptions.value.some((option) => option.value === target.value)) {
    return;
  }

  await settingsStore.updateSetting('logLevel', target.value as 'debug' | 'info' | 'warn' | 'error');
};

const handleLogAutoClearChange = async (event: Event) => {
  const target = event.target as HTMLSelectElement;
  const value = Number.parseInt(target.value, 10);

  if (!LOG_AUTO_CLEAR_DAY_OPTIONS.includes(value)) {
    return;
  }

  await settingsStore.updateSetting('logAutoClearDays', value);
};

const handleOpenLogDir = () => {
  settingsStore.openLogDir();
};
</script>
