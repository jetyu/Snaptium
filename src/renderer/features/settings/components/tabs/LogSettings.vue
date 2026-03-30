<template>
  <div class="log-settings">
    <h3 class="panel-title">{{ t('paneLog') }}</h3>

    <div class="settings-grid">
      <!-- Enable Logging Toggle -->
      <section class="setting-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('labelLoggingEnabled') }}</p>
          <p class="setting-description">{{ t('textLoggingEnabled') }}</p>
        </div>

        <button type="button" class="startup-switch" :class="{ enabled: settingsStore.config.loggingEnabled }"
          :aria-pressed="settingsStore.config.loggingEnabled" @click="handleLoggingToggle">
          <span class="startup-switch-track">
            <span class="startup-switch-thumb" />
          </span>
          <span class="startup-switch-text">
            {{ settingsStore.config.loggingEnabled ? t('statusEnabled') : t('statusDisabled') }}
          </span>
        </button>
      </section>

      <!-- Log Level Select -->
      <section class="setting-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('labelLogLevel') }}</p>
          <p class="setting-description">{{ t('logLevelDesc') }}</p>
        </div>

        <label class="select-shell" :class="{ disabled: !settingsStore.config.loggingEnabled }">
          <select class="settings-select" :value="settingsStore.config.logLevel" @change="handleLogLevelChange"
            :disabled="!settingsStore.config.loggingEnabled">
            <option v-for="option in logLevelOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>
      </section>

      <!-- Open Log Directory -->
      <section class="setting-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('btnLogFolder') }}</p>
          <p class="setting-description">{{ t('contextMenu.showInFolder') }}</p>
        </div>

        <button class="action-button" @click="handleOpenLogDir">
          {{ t('btnLogFolder') }}
        </button>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useSettingsStore } from '../../store/settings.store';

const { t } = useI18n();
const settingsStore = useSettingsStore();

const logLevelOptions = computed(() => [
  { value: 'debug', label: t('optionLogLevelDebug') },
  { value: 'info', label: t('optionLogLevelInfo') },
  { value: 'warn', label: t('optionLogLevelWarn') },
  { value: 'error', label: t('optionLogLevelError') },
]);

const handleLoggingToggle = async () => {
  await settingsStore.updateSetting('loggingEnabled', !settingsStore.config.loggingEnabled);
};

const handleLogLevelChange = async (event: Event) => {
  const target = event.target as HTMLSelectElement;
  await settingsStore.updateSetting('logLevel', target.value as any);
};

const handleOpenLogDir = () => {
  settingsStore.openLogDir();
};
</script>

<style scoped>
.log-settings {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}
</style>
