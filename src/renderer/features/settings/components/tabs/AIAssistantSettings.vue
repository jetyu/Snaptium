<template>
  <div class="ai-settings">
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
        <label class="select-shell">
          <select class="settings-select" :value="settingsStore.config.aiAssistant.sourceId"
            @change="handleAssistantUpdate('sourceId', ($event.target as HTMLSelectElement).value)"
            :disabled="!settingsStore.config.aiAssistant.enabled">
            <option v-if="settingsStore.config.aiSources.length === 0" value="" disabled>{{
              t('option.aiSource.noSourceFound') }}</option>
            <option v-for="source in settingsStore.config.aiSources" :key="source.id" :value="source.id">
              {{ source.name }}
            </option>
          </select>
        </label>
      </section>
      <div class="settings-row-grid">
        <section class="setting-card">
          <div class="setting-copy">
            <p class="setting-label">{{ t('label.aiWritingStyle') }}</p>
            <p class="setting-description">{{ t('text.aiWritingStyle') }}</p>
          </div>
          <label class="select-shell">
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
          <label class="select-shell">
            <select class="settings-select" :value="settingsStore.config.aiAssistant.writingScenario"
              @change="handleAssistantUpdate('writingScenario', ($event.target as HTMLSelectElement).value)"
              :disabled="!settingsStore.config.aiAssistant.enabled">
              <option v-for="option in writingScenarioOptions" :key="option.value" :value="option.value">
                {{ t(option.labelKey) }}
              </option>
            </select>
          </label>
        </section>
      </div>

      <div class="settings-row-grid">
        <!-- Input Delay -->
        <section class="setting-card">
          <div class="setting-copy">
            <p class="setting-label">{{ t('label.aiTypingDelay') }}</p>
            <p class="setting-description">{{ t('text.unitMilliseconds') }}</p>
          </div>
          <div class="number-input-container">
            <input type="number" class="settings-input number-input"
              :value="settingsStore.config.aiAssistant.typingDelay"
              @input="handleAssistantNumberUpdate('typingDelay', $event)" step="100" min="500"
              :disabled="!settingsStore.config.aiAssistant.enabled" />
          </div>
        </section>

        <!-- Min Input Length -->
        <section class="setting-card">
          <div class="setting-copy">
            <p class="setting-label">{{ t('label.aiMinInputLength') }}</p>
            <p class="setting-description">{{ t('text.unitCharacters') }}</p>
          </div>
          <div class="number-input-container">
            <input type="number" class="settings-input number-input"
              :value="settingsStore.config.aiAssistant.minInputLength"
              @input="handleAssistantNumberUpdate('minInputLength', $event)" min="1"
              :disabled="!settingsStore.config.aiAssistant.enabled" />
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  AI_WRITING_SCENARIO_OPTIONS,
  AI_WRITING_STYLE_OPTIONS,
} from '@renderer/features/ai/constants/ai.constants';
import { useSettingsStore, type AIAssistantSettings } from '../../store/settings.store';

const { t } = useI18n();
const settingsStore = useSettingsStore();
const writingStyleOptions = AI_WRITING_STYLE_OPTIONS;
const writingScenarioOptions = AI_WRITING_SCENARIO_OPTIONS;

const currentWritingStyleSummary = computed(() => {
  const selectedOption = writingStyleOptions.find(
    (option) => option.value === settingsStore.config.aiAssistant.writingStyle
  ) ?? writingStyleOptions[0];

  return t(selectedOption.summaryKey);
});

const currentWritingScenarioLabel = computed(() => {
  const selectedOption = writingScenarioOptions.find(
    (option) => option.value === settingsStore.config.aiAssistant.writingScenario
  ) ?? writingScenarioOptions[0];

  return t(selectedOption.labelKey);
});

const systemPromptPreview = computed(() => t('text.aiSystemPromptPreview', {
  style: currentWritingStyleSummary.value,
  scenario: currentWritingScenarioLabel.value,
}));

const handleToggle = async (key: keyof AIAssistantSettings) => {
  await settingsStore.updateAssistantSetting(key, !settingsStore.config.aiAssistant[key]);
};

const handleAssistantUpdate = async (key: keyof AIAssistantSettings, value: any) => {
  await settingsStore.updateAssistantSetting(key, value);
};

const handleAssistantNumberUpdate = async (key: keyof AIAssistantSettings, event: Event) => {
  const target = event.target as HTMLInputElement;
  await settingsStore.updateAssistantSetting(key, parseInt(target.value) || 0);
};
</script>

<style scoped>
.ai-settings {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.settings-row-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
}

.settings-row-grid :deep(.number-input-container) {
  width: 100px;
}

.settings-textarea {
  height: 200px;
}

.prompt-preview {
  height: 72px;
  resize: none;
}
</style>
