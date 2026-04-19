<template>
  <div class="editor-settings">
    <h3 class="panel-title">{{ t('pref.pane.editor') }}</h3>

    <!-- Editor Behavior Settings -->
    <div class="settings-row-grid">
      <!-- Editor Font Size -->

      <section class="setting-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('label.editorFontSize') }}</p>
          <p class="setting-description">{{ t('text.editorFontSize') }}</p>
        </div>
        <div class="number-input-container">
          <input type="number" class="settings-input number-input" :value="settingsStore.config.editorFontSize"
            @change="handleFontSizeChange" min="10" max="32" step="1" />
        </div>
      </section>

      <!-- Editor Font -->
      <section class="setting-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('label.editorFont') }}</p>
          <p class="setting-description">{{ t('text.editorFont') }}</p>
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
          <p class="setting-label">{{ t('label.showLineNumbers') }}</p>
          <p class="setting-description">{{ t('text.showLineNumbers ') }}</p>
        </div>
        <button type="button" class="startup-switch" :class="{ enabled: settingsStore.config.showLineNumbers }"
          :aria-pressed="settingsStore.config.showLineNumbers"
          @click="() => settingsStore.updateSetting('showLineNumbers', !settingsStore.config.showLineNumbers)">
          <span class="startup-switch-track">
            <span class="startup-switch-thumb" />
          </span>
          <span class="startup-switch-text">
            {{ settingsStore.config.showLineNumbers ? t('checkbox.status.enabled') : t('checkbox.status.disabled') }}
          </span>
        </button>
      </section>

      <!-- Word Wrap -->
      <section class="setting-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('label.wordWrap') }}</p>
          <p class="setting-description">{{ t('text.wordWrap') }}</p>
        </div>
        <button type="button" class="startup-switch" :class="{ enabled: settingsStore.config.wordWrap }"
          :aria-pressed="settingsStore.config.wordWrap"
          @click="() => settingsStore.updateSetting('wordWrap', !settingsStore.config.wordWrap)">
          <span class="startup-switch-track">
            <span class="startup-switch-thumb" />
          </span>
          <span class="startup-switch-text">
            {{ settingsStore.config.wordWrap ? t('checkbox.status.enabled') : t('checkbox.status.disabled') }}
          </span>
        </button>
      </section>

      <!-- Code Folding -->
      <section class="setting-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('label.codeFolding') }}</p>
          <p class="setting-description">{{ t('text.codeFolding') }}</p>
        </div>
        <button type="button" class="startup-switch" :class="{ enabled: settingsStore.config.codeFolding }"
          :aria-pressed="settingsStore.config.codeFolding"
          @click="() => settingsStore.updateSetting('codeFolding', !settingsStore.config.codeFolding)">
          <span class="startup-switch-track">
            <span class="startup-switch-thumb" />
          </span>
          <span class="startup-switch-text">
            {{ settingsStore.config.codeFolding ? t('checkbox.status.enabled') : t('checkbox.status.disabled') }}
          </span>
        </button>
      </section>

      <!-- Highlight Active Line -->
      <section class="setting-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('text.highlightActiveLine') }}</p>
          <p class="setting-description">{{ t('textHighlightActiveLine') }}</p>
        </div>
        <button type="button" class="startup-switch" :class="{ enabled: settingsStore.config.highlightActiveLine }"
          :aria-pressed="settingsStore.config.highlightActiveLine"
          @click="() => settingsStore.updateSetting('highlightActiveLine', !settingsStore.config.highlightActiveLine)">
          <span class="startup-switch-track">
            <span class="startup-switch-thumb" />
          </span>
          <span class="startup-switch-text">
            {{ settingsStore.config.highlightActiveLine ? t('checkbox.status.enabled') : t('checkbox.status.disabled')
            }}
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
            {{ settingsStore.config.bracketMatching ? t('checkbox.status.enabled') : t('checkbox.status.disabled') }}
          </span>
        </button>
      </section>

      <!-- Auto Close Brackets -->
      <section class="setting-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('label.autoCloseBrackets') }}</p>
          <p class="setting-description">{{ t('text.autoCloseBrackets') }}</p>
        </div>
        <button type="button" class="startup-switch" :class="{ enabled: settingsStore.config.autoCloseBrackets }"
          :aria-pressed="settingsStore.config.autoCloseBrackets"
          @click="() => settingsStore.updateSetting('autoCloseBrackets', !settingsStore.config.autoCloseBrackets)">
          <span class="startup-switch-track">
            <span class="startup-switch-thumb" />
          </span>
          <span class="startup-switch-text">
            {{ settingsStore.config.autoCloseBrackets ? t('checkbox.status.enabled') : t('checkbox.status.disabled') }}
          </span>
        </button>
      </section>

      <!-- Auto Indent -->
      <section class="setting-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('label.autoIndent') }}</p>
          <p class="setting-description">{{ t('text.autoIndent') }}</p>
        </div>
        <button type="button" class="startup-switch" :class="{ enabled: settingsStore.config.autoIndent }"
          :aria-pressed="settingsStore.config.autoIndent"
          @click="() => settingsStore.updateSetting('autoIndent', !settingsStore.config.autoIndent)">
          <span class="startup-switch-track">
            <span class="startup-switch-thumb" />
          </span>
          <span class="startup-switch-text">
            {{ settingsStore.config.autoIndent ? t('checkbox.status.enabled') : t('checkbox.status.disabled') }}
          </span>
        </button>
      </section>

      <!-- Show Status Bar -->
      <section class="setting-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('label.showStatusBar') }}</p>
          <p class="setting-description">{{ t('text.showStatusBar') }}</p>
        </div>
        <button type="button" class="startup-switch" :class="{ enabled: settingsStore.config.showStatusBar }"
          :aria-pressed="settingsStore.config.showStatusBar"
          @click="() => settingsStore.updateSetting('showStatusBar', !settingsStore.config.showStatusBar)">
          <span class="startup-switch-track">
            <span class="startup-switch-thumb" />
          </span>
          <span class="startup-switch-text">
            {{ settingsStore.config.showStatusBar ? t('checkbox.status.enabled') : t('checkbox.status.disabled') }}
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

<style scoped></style>
