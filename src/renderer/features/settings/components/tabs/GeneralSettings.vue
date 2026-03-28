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
          <select class="language-select" :value="settingsStore.config.language" @change="handleLanguageChange">
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

.panel-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary, #111827);
}

.settings-grid {
  display: grid;
  gap: 0.75rem;
}

.setting-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-height: 84px;
  padding: 0.95rem 1rem;
  border: 1px solid #e7eaf0;
  border-radius: 10px;
  background: #fbfbfc;
}

.setting-copy {
  min-width: 0;
}

.setting-label {
  margin: 0 0 0.25rem;
  font-size: 0.95rem;
  font-weight: 600;
  color: #111827;
}

.setting-description {
  margin: 0;
  color: #5f6b7a;
  font-size: 0.85rem;
  line-height: 1.4;
}

.select-shell {
  position: relative;
  min-width: 232px;
}

.language-select {
  width: 100%;
  min-height: 38px;
  padding: 0.5rem 2.25rem 0.5rem 0.75rem;
  border: 1px solid #c9d1dc;
  border-radius: 8px;
  background: #ffffff;
  color: #111827;
  font-size: 0.9rem;
  appearance: none;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;
}

.language-select:hover,
.language-select:focus {
  border-color: #7aa7ff;
  box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.18);
  outline: none;
}

.select-shell::after {
  content: '';
  position: absolute;
  top: 50%;
  right: 1rem;
  width: 0.6rem;
  height: 0.6rem;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  color: #6b7280;
  pointer-events: none;
  transform: translateY(-65%) rotate(45deg);
}

.startup-switch {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  min-height: 38px;
  padding: 0.25rem 0.45rem 0.25rem 0.25rem;
  border: 1px solid #d7dce3;
  border-radius: 999px;
  background: #ffffff;
  color: #111827;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}

.startup-switch.enabled {
  background: #f6f9ff;
  border-color: #bfd3ff;
}

.startup-switch:hover,
.startup-switch:focus-visible {
  border-color: #7aa7ff;
  box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.14);
  outline: none;
}

.startup-switch-track {
  position: relative;
  width: 2.8rem;
  height: 1.55rem;
  border-radius: 999px;
  flex-shrink: 0;
  background: #c7ced8;
  transition: background-color 0.15s ease;
}

.startup-switch.enabled .startup-switch-track {
  background: #0f6cbd;
}

.startup-switch-thumb {
  position: absolute;
  top: 0.1rem;
  left: 0.1rem;
  width: 1.35rem;
  height: 1.35rem;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.2);
  transition: transform 0.15s ease;
}

.startup-switch.enabled .startup-switch-thumb {
  transform: translateX(1.25rem);
}

.startup-switch-text {
  min-width: 7rem;
  text-align: left;
  font-size: 0.85rem;
  font-weight: 500;
  color: #4b5563;
}

@media (max-width: 720px) {
  .setting-card {
    flex-direction: column;
    align-items: stretch;
    min-height: auto;
  }

  .select-shell {
    min-width: auto;
  }

  .startup-switch {
    min-width: auto;
    justify-content: space-between;
  }
}
</style>
