<template>
  <div class="general-settings">
    <h3 class="panel-title">{{ t('pref.pane.general') }}</h3>

    <div class="settings-grid">
      <section class="setting-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('label.autoStartUp') }}</p>
          <p class="setting-description">{{ t('text.autoStartup') }}</p>
        </div>
        <button type="button" class="startup-switch" :class="{ enabled: settingsStore.config.autoStartup }"
          :aria-pressed="settingsStore.config.autoStartup" @click="handleStartupToggle">
          <span class="startup-switch-track">
            <span class="startup-switch-thumb" />
          </span>
          <span class="startup-switch-text">
            {{ settingsStore.config.autoStartup ? t('checkbox.status.enabled') : t('checkbox.status.disabled') }}
          </span>
        </button>
      </section>
      <section class="setting-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('label.language') }}</p>
          <p class="setting-description">{{ t('text.UIDisplayLanguage') }}</p>
        </div>

        <label class="select-shell">
          <select class="settings-select" :value="settingsStore.config.language" @change="handleLanguageChange">
            <option v-for="option in languageOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>
      </section>
      <section class="setting-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('label.themeMode', 'Theme Mode') }}</p>
          <p class="setting-description">{{ t('text.themeMode', 'Select application color theme') }}</p>
        </div>
        <label class="select-shell">
          <select class="settings-select" :value="settingsStore.config.themeMode" @change="handleThemeChange">
            <option value="system">{{ t('option.theme.system', 'System') }}</option>
            <option value="light">{{ t('option.theme.light', 'Light') }}</option>
            <option value="dark">{{ t('option.theme.dark', 'Dark') }}</option>
          </select>
        </label>
      </section>
      <div :class="{ 'settings-row-grid': settingsStore.config.autoCheckUpdates }">
        <section class="setting-card">
          <div class="setting-copy">
            <p class="setting-label">{{ t('label.softwareAutoUpdate') }}</p>
            <p class="setting-description">{{ t('text.softwareAutoUpdate') }}</p>
          </div>
          <button type="button" class="startup-switch" :class="{ enabled: settingsStore.config.autoCheckUpdates }"
            :aria-pressed="settingsStore.config.autoCheckUpdates" @click="handleAutoUpdateToggle">
            <span class="startup-switch-track">
              <span class="startup-switch-thumb" />
            </span>
            <span class="startup-switch-text">
              {{ settingsStore.config.autoCheckUpdates ? t('checkbox.status.enabled') : t('checkbox.status.disabled') }}
            </span>
          </button>
        </section>
        <section v-if="settingsStore.config.autoCheckUpdates" class="setting-card">
          <div class="setting-copy">
            <p class="setting-label">{{ t('label.updateCheckInterval') }}</p>
            <p class="setting-description">{{ t('text.updateCheckInterval') }}</p>
          </div>
          <div class="number-input-container">
            <input type="number" class="settings-input number-input" :value="updateIntervalHours" min="1" max="168"
              @change="handleIntervalChange" />
          </div>
        </section>
      </div>

      <section class="setting-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('label.importExportSettings') }}</p>
          <p class="setting-description">{{ t('text.importExportSettings') }}</p>
        </div>
        <div style="display: flex; gap: 8px;">
          <button type="button" class="action-button" @click="handleExportSettings">
            {{ t('button.exportSettings') }}
          </button>
          <button type="button" class="action-button" @click="handleImportSettings">
            {{ t('button.importSettings') }}
          </button>
        </div>
      </section>

    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { languageOptions } from '@renderer/features/i18n';
import { updaterService } from '@renderer/features/updater/services/updater.service';
import { useSettingsStore } from '../../store/settings.store';
import { settingsService } from '../../services/settings.service';

const { t } = useI18n();
const settingsStore = useSettingsStore();

const handleLanguageChange = async (event: Event) => {
  const target = event.target as HTMLSelectElement;
  await settingsStore.setLanguage(target.value);
};

const handleThemeChange = async (event: Event) => {
  const target = event.target as HTMLSelectElement;
  await settingsStore.updateSetting('themeMode', target.value as 'system' | 'light' | 'dark');
};

const handleExportSettings = async () => {
  await settingsService.exportConfig();
};

const handleImportSettings = async () => {
  await settingsService.importConfig();
};

const handleStartupToggle = async () => {
  await settingsStore.setAutoStartup(!settingsStore.config.autoStartup);
};

const handleAutoUpdateToggle = async () => {
  const newValue = !settingsStore.config.autoCheckUpdates;
  await settingsStore.updateSetting('autoCheckUpdates', newValue);

  await updaterService.updateConfig({
    autoCheckUpdates: newValue,
    updateCheckInterval: settingsStore.config.updateCheckInterval
  });
};

const updateIntervalHours = computed({
  get: () => Math.round(settingsStore.config.updateCheckInterval / (60 * 60 * 1000)),
  set: (val: number) => {
    const ms = val * 60 * 60 * 1000;
    settingsStore.updateSetting('updateCheckInterval', ms);
    updaterService.updateConfig({
      autoCheckUpdates: settingsStore.config.autoCheckUpdates,
      updateCheckInterval: ms
    });
  }
});

const handleIntervalChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const val = parseInt(target.value, 10);
  if (!isNaN(val) && val > 0) {
    updateIntervalHours.value = val;
  }
};

</script>

<style scoped>
.general-settings {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.settings-row-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
}

@media (max-width: 1024px) {
  .settings-row-grid {
    grid-template-columns: 1fr;
  }
}

.number-input-container {
  width: 100px;
}
</style>
