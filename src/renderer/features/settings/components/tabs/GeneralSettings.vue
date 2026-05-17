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
          <p class="setting-label">{{ t('label.startupDefaultView') }}</p>
          <p class="setting-description">{{ t('text.startupDefaultView') }}</p>
        </div>
        <label class="select-shell">
          <select class="settings-select" :value="settingsStore.config.appShell.activeMainView"
            @change="handleStartupViewChange">
            <option value="workbench">{{ t('option.startup.workbench') }}</option>
            <option value="workspace">{{ t('option.startup.workspace') }}</option>
            <option value="tags">{{ t('option.startup.tags') }}</option>
          </select>
        </label>
      </section>

      <section class="setting-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('label.themeMode') }}</p>
          <p class="setting-description">{{ t('text.themeMode') }}</p>
        </div>
        <label class="select-shell">
          <select class="settings-select" :value="settingsStore.config.themeMode" @change="handleThemeChange">
            <option value="system">{{ t('option.theme.system') }}</option>
            <option value="light">{{ t('option.theme.light') }}</option>
            <option value="dark">{{ t('option.theme.dark') }}</option>
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
        <div class="settings-row">
          <button type="button" class="action-button" @click="handleExportSettings">
            {{ t('button.export') }}
          </button>
          <button type="button" class="action-button" @click="handleImportSettings">
            {{ t('button.import') }}
          </button>
          <button type="button" class="action-button" @click="handleResetSettings">
            {{ t('button.reset') }}
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
import { type AppShellMainViewId } from '@renderer/app/constants/appShell.constants';
import { useSettingsStore } from '../../store/settings.store';

const { t } = useI18n();
const settingsStore = useSettingsStore();

const handleLanguageChange = async (event: Event) => {
  const target = event.target as HTMLSelectElement;
  await settingsStore.setLanguage(target.value);
};

const handleExportSettings = async () => {
  await settingsStore.exportSettings();
};

const handleImportSettings = async () => {
  await settingsStore.importSettings();
};

const handleResetSettings = async () => {
  await settingsStore.resetSettings();
};

const handleStartupToggle = async () => {
  await settingsStore.setAutoStartup(!settingsStore.config.autoStartup);
};

const handleStartupViewChange = async (event: Event) => {
  const target = event.target as HTMLSelectElement;
  const value = target.value as AppShellMainViewId;
  await settingsStore.updateSetting('appShell', {
    ...settingsStore.config.appShell,
    activeMainView: value,
  });
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

const handleThemeChange = async (event: Event) => {
  const target = event.target as HTMLSelectElement;
  await settingsStore.updateSetting('themeMode', target.value as 'system' | 'light' | 'dark');
};
</script>
