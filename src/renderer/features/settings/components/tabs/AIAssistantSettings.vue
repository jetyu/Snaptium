<template>
  <div class="ai-assistant-settings">
    <h3 class="panel-title">{{ t('pref.pane.aiAssistant') }}</h3>
    <div class="settings-grid">
      <!-- Enable AI Assistant -->
      <section class="setting-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('label.aiAssistant') }}</p>
          <p class="setting-description">{{ t('text.aiAssistant') }}</p>
        </div>
        <button type="button" class="startup-switch" :class="{ enabled: settingsStore.config.aiAssistant.enabled }"
          :aria-pressed="settingsStore.config.aiAssistant.enabled" @click="handleToggle('enabled')">
          <span class="startup-switch-track">
            <span class="startup-switch-thumb" />
          </span>
          <span class="startup-switch-text">
            {{ settingsStore.config.aiAssistant.enabled ? t('checkbox.status.enabled') : t('checkbox.status.disabled')
            }}
          </span>
        </button>
      </section>
      <!-- Source Selection -->
      <section class="setting-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('label.selectAIAssistantSourceName') }}</p>
          <p class="setting-description">{{ t('text.selectAIAssistantSourceName') }}</p>
        </div>
        <label class="select-shell" :class="{ disabled: !settingsStore.config.aiAssistant.enabled }">
          <select class="settings-select" :value="settingsStore.config.aiAssistant.sourceId"
            @change="handleAssistantUpdate('sourceId', ($event.target as HTMLSelectElement).value)"
            :disabled="!settingsStore.config.aiAssistant.enabled">
            <option v-if="settingsStore.config.aiSources.length === 0" value="" disabled>{{
              t('option.default.selectOption') }}</option>
            <option v-for="source in settingsStore.config.aiSources" :key="source.id" :value="source.id">
              {{ source.name }}
            </option>
          </select>
        </label>
      </section>
      <!-- AI Trigger Mode -->
      <section class="setting-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('label.aiWritingMode') }}</p>
          <p class="setting-description">{{ t(`text.aiWritingMode.${settingsStore.config.aiAssistant.triggerMode}`) }}
          </p>
        </div>
        <label class="select-shell" :class="{ disabled: !settingsStore.config.aiAssistant.enabled }">
          <select class="settings-select" :value="settingsStore.config.aiAssistant.triggerMode"
            @change="handleAssistantUpdate('triggerMode', ($event.target as HTMLSelectElement).value)"
            :disabled="!settingsStore.config.aiAssistant.enabled">
            <option v-for="option in writingModeOptions" :key="option.value" :value="option.value">
              {{ t(option.labelKey) }}
            </option>
          </select>
        </label>
      </section>
      <section class="setting-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('label.aiWritingStyle') }}</p>
          <p class="setting-description">{{ t('text.aiWritingStyle') }}</p>
        </div>
        <label class="select-shell" :class="{ disabled: !settingsStore.config.aiAssistant.enabled }">
          <select class="settings-select" :value="settingsStore.config.aiAssistant.writingStyle"
            @change="handleAssistantUpdate('writingStyle', ($event.target as HTMLSelectElement).value)"
            :disabled="!settingsStore.config.aiAssistant.enabled">
            <option v-for="option in writingStyleOptions" :key="option.value" :value="option.value">
              {{ t(option.labelKey) }}
            </option>
          </select>
        </label>
      </section>
      <section class="setting-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('label.aiWritingScenario') }}</p>
          <p class="setting-description">{{ t('text.aiWritingScenario') }}</p>
        </div>
        <label class="select-shell" :class="{ disabled: !settingsStore.config.aiAssistant.enabled }">
          <select class="settings-select" :value="settingsStore.config.aiAssistant.writingScenario"
            @change="handleAssistantUpdate('writingScenario', ($event.target as HTMLSelectElement).value)"
            :disabled="!settingsStore.config.aiAssistant.enabled">
            <option v-for="option in writingScenarioOptions" :key="option.value" :value="option.value">
              {{ t(option.labelKey) }}
            </option>
          </select>
        </label>
      </section>
      <!-- Auto Continue -->
      <section class="setting-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('label.aiAutoContinue') }}</p>
          <p class="setting-description">{{ t('text.aiAutoContinue') }}</p>
        </div>
        <button type="button" class="startup-switch" :class="{ enabled: settingsStore.config.aiAssistant.autoContinue }"
          :aria-pressed="settingsStore.config.aiAssistant.autoContinue" @click="handleToggle('autoContinue')"
          :disabled="!settingsStore.config.aiAssistant.enabled" style="margin-left: auto;">
          <span class="startup-switch-track">
            <span class="startup-switch-thumb" />
          </span>
        </button>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import {
  AI_WRITING_SCENARIO_OPTIONS,
  AI_WRITING_STYLE_OPTIONS,
  AI_WRITING_MODE_OPTIONS,
} from '@renderer/features/ai/constants/ai.constants';
import { useSettingsStore, type AIAssistantSettings } from '../../store/settings.store';

const { t } = useI18n();
const settingsStore = useSettingsStore();
const writingStyleOptions = AI_WRITING_STYLE_OPTIONS;
const writingScenarioOptions = AI_WRITING_SCENARIO_OPTIONS;
const writingModeOptions = AI_WRITING_MODE_OPTIONS;

const handleToggle = async (key: keyof AIAssistantSettings) => {
  await settingsStore.updateAssistantSetting(key, !settingsStore.config.aiAssistant[key]);
};

const handleAssistantUpdate = async (key: keyof AIAssistantSettings, value: any) => {
  await settingsStore.updateAssistantSetting(key, value);
};

// Removed handleAssistantNumberUpdate as typingDelay is removed
</script>

<style scoped>
.settings-textarea {
  height: 200px;
}

.prompt-preview {
  height: 72px;
  resize: none;
}
</style>
