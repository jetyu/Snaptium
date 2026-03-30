<template>
  <div class="editor-settings">
    <h3 class="panel-title">{{ t('paneEditorSettings') }}</h3>

    <!-- Editor Behavior Settings -->
    <div class="settings-grid two-cols" style="margin-top: 0.5rem;">
      <!-- Editor Font Size -->
      <section class="setting-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('labelEditorFontSize') }}</p>
          <p class="setting-description">{{ t('textEditorFontSize') }}</p>
        </div>
        <div class="input-container number-input-container">
          <input type="number" class="settings-input number-input" :value="settingsStore.config.editorFontSize"
            @change="handleFontSizeChange" min="10" max="32" step="1" />
        </div>
      </section>

      <!-- Editor Font -->
      <section class="setting-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('labelEditorFont') }}</p>
          <p class="setting-description">{{ t('textEditorFont') }}</p>
        </div>
        <label class="select-shell">
          <select class="settings-select" :value="settingsStore.config.editorFont" @change="handleFontChange">
            <option v-for="font in fontOptions" :key="font.id" :value="font.value">
              {{ font.label }}
            </option>
          </select>
        </label>
      </section>
      <!-- Line Numbers -->
      <section class="setting-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('labelShowLineNumbers') }}</p>
          <p class="setting-description">{{ t('textShowLineNumbers') }}</p>
        </div>
        <button type="button" class="startup-switch" :class="{ enabled: settingsStore.config.showLineNumbers }"
          :aria-pressed="settingsStore.config.showLineNumbers"
          @click="() => settingsStore.updateSetting('showLineNumbers', !settingsStore.config.showLineNumbers)">
          <span class="startup-switch-track">
            <span class="startup-switch-thumb" />
          </span>
          <span class="startup-switch-text">
            {{ settingsStore.config.showLineNumbers ? t('statusEnabled') : t('statusDisabled') }}
          </span>
        </button>
      </section>

      <!-- Word Wrap -->
      <section class="setting-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('labelWordWrap') }}</p>
          <p class="setting-description">{{ t('textWordWrap') }}</p>
        </div>
        <button type="button" class="startup-switch" :class="{ enabled: settingsStore.config.wordWrap }"
          :aria-pressed="settingsStore.config.wordWrap"
          @click="() => settingsStore.updateSetting('wordWrap', !settingsStore.config.wordWrap)">
          <span class="startup-switch-track">
            <span class="startup-switch-thumb" />
          </span>
          <span class="startup-switch-text">
            {{ settingsStore.config.wordWrap ? t('statusEnabled') : t('statusDisabled') }}
          </span>
        </button>
      </section>

      <!-- Code Folding -->
      <section class="setting-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('labelCodeFolding') }}</p>
          <p class="setting-description">{{ t('textCodeFolding') }}</p>
        </div>
        <button type="button" class="startup-switch" :class="{ enabled: settingsStore.config.codeFolding }"
          :aria-pressed="settingsStore.config.codeFolding"
          @click="() => settingsStore.updateSetting('codeFolding', !settingsStore.config.codeFolding)">
          <span class="startup-switch-track">
            <span class="startup-switch-thumb" />
          </span>
          <span class="startup-switch-text">
            {{ settingsStore.config.codeFolding ? t('statusEnabled') : t('statusDisabled') }}
          </span>
        </button>
      </section>

      <!-- Highlight Active Line -->
      <section class="setting-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('labelHighlightActiveLine') }}</p>
          <p class="setting-description">{{ t('textHighlightActiveLine') }}</p>
        </div>
        <button type="button" class="startup-switch" :class="{ enabled: settingsStore.config.highlightActiveLine }"
          :aria-pressed="settingsStore.config.highlightActiveLine"
          @click="() => settingsStore.updateSetting('highlightActiveLine', !settingsStore.config.highlightActiveLine)">
          <span class="startup-switch-track">
            <span class="startup-switch-thumb" />
          </span>
          <span class="startup-switch-text">
            {{ settingsStore.config.highlightActiveLine ? t('statusEnabled') : t('statusDisabled') }}
          </span>
        </button>
      </section>

      <!-- Bracket Matching -->
      <section class="setting-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('labelBracketMatching') }}</p>
          <p class="setting-description">{{ t('textBracketMatching') }}</p>
        </div>
        <button type="button" class="startup-switch" :class="{ enabled: settingsStore.config.bracketMatching }"
          :aria-pressed="settingsStore.config.bracketMatching"
          @click="() => settingsStore.updateSetting('bracketMatching', !settingsStore.config.bracketMatching)">
          <span class="startup-switch-track">
            <span class="startup-switch-thumb" />
          </span>
          <span class="startup-switch-text">
            {{ settingsStore.config.bracketMatching ? t('statusEnabled') : t('statusDisabled') }}
          </span>
        </button>
      </section>

      <!-- Auto Close Brackets -->
      <section class="setting-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('labelAutoCloseBrackets') }}</p>
          <p class="setting-description">{{ t('textAutoCloseBrackets') }}</p>
        </div>
        <button type="button" class="startup-switch" :class="{ enabled: settingsStore.config.autoCloseBrackets }"
          :aria-pressed="settingsStore.config.autoCloseBrackets"
          @click="() => settingsStore.updateSetting('autoCloseBrackets', !settingsStore.config.autoCloseBrackets)">
          <span class="startup-switch-track">
            <span class="startup-switch-thumb" />
          </span>
          <span class="startup-switch-text">
            {{ settingsStore.config.autoCloseBrackets ? t('statusEnabled') : t('statusDisabled') }}
          </span>
        </button>
      </section>

      <!-- Auto Indent -->
      <section class="setting-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('labelAutoIndent') }}</p>
          <p class="setting-description">{{ t('textAutoIndent') }}</p>
        </div>
        <button type="button" class="startup-switch" :class="{ enabled: settingsStore.config.autoIndent }"
          :aria-pressed="settingsStore.config.autoIndent"
          @click="() => settingsStore.updateSetting('autoIndent', !settingsStore.config.autoIndent)">
          <span class="startup-switch-track">
            <span class="startup-switch-thumb" />
          </span>
          <span class="startup-switch-text">
            {{ settingsStore.config.autoIndent ? t('statusEnabled') : t('statusDisabled') }}
          </span>
        </button>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useSettingsStore } from '../../store/settings.store';
import fontProvider from '@renderer/config/font-provider.json';

const { t } = useI18n();
const settingsStore = useSettingsStore();

const fontOptions = fontProvider;

const handleFontSizeChange = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const val = parseInt(target.value, 10);
  if (!isNaN(val) && val >= 10 && val <= 32) {
    await settingsStore.updateSetting('editorFontSize', val);
  }
};

const handleFontChange = async (event: Event) => {
  const target = event.target as HTMLSelectElement;
  await settingsStore.updateSetting('editorFont', target.value);
};
</script>

<style scoped>
.editor-settings {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.panel-subtitle {
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
  font-size: 1.1rem;
  font-weight: 500;
  color: var(--text-color);
}

.two-cols {
  grid-template-columns: repeat(2, 1fr);
}

.two-cols :deep(.select-shell),
.two-cols :deep(.input-container) {
  min-width: 130px;
}

.two-cols :deep(.number-input-container) {
  width: 90px;
}

.two-cols :deep(.startup-switch-text) {
  min-width: auto;
  white-space: nowrap;
}
</style>
