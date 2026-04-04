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


      <!-- System Prompt -->
      <section class="setting-card col-span-full vertical-layout">
        <div class="setting-copy">
          <p class="setting-label">{{ t('label.aiSystemPrompt') }}</p>
          <p class="setting-description">{{ t('text.AISystemPrompt') }}</p>
        </div>
        <textarea class="settings-textarea" :value="settingsStore.config.aiAssistant.systemPrompt"
          @input="handleAssistantUpdate('systemPrompt', ($event.target as HTMLTextAreaElement).value)"
          :placeholder="t('ai.prompt.autoComplete')" :disabled="!settingsStore.config.aiAssistant.enabled"></textarea>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useSettingsStore, type AIAssistantSettings } from '../../store/settings.store';

const { t } = useI18n();
const settingsStore = useSettingsStore();

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
</style>
