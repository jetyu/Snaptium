<template>
  <div class="general-settings">
    <h3 class="panel-title">{{ t('paneGeneral') }}</h3>

    <div class="settings-grid">
      <section class="setting-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('labelStartup') }}</p>
          <p class="setting-description">{{ t('textStartup') }}</p>
        </div>

        <button type="button" class="startup-switch" :class="{ enabled: settingsStore.config.autoStartup }"
          :aria-pressed="settingsStore.config.autoStartup" @click="handleStartupToggle">
          <span class="startup-switch-track">
            <span class="startup-switch-thumb" />
          </span>
          <span class="startup-switch-text">
            {{ settingsStore.config.autoStartup ? t('startupEnabledStatus') : t('startupDisabledStatus') }}
          </span>
        </button>
      </section>
      <section class="setting-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('labelLanguage') }}</p>
          <p class="setting-description">{{ t('textUIDisplayLanguage') }}</p>
        </div>

        <label class="select-shell">
          <select class="settings-select" :value="settingsStore.config.language" @change="handleLanguageChange">
            <option v-for="option in languageOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>
      </section>


    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { languageOptions } from '@renderer/features/i18n';
import { useSettingsStore } from '../../store/settings.store';

const { t } = useI18n();
const settingsStore = useSettingsStore();

const currentLanguageLabel = computed(
  () => languageOptions.find((option) => option.value === settingsStore.config.language)?.label ?? settingsStore.config.language,
);

const handleLanguageChange = async (event: Event) => {
  const target = event.target as HTMLSelectElement;
  await settingsStore.setLanguage(target.value);
};

const handleStartupToggle = async () => {
  await settingsStore.setAutoStartup(!settingsStore.config.autoStartup);
};
</script>

<style scoped>
.general-settings {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}
</style>
