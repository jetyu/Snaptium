<template>
  <div class="shortcut-settings">
    <div class="section-header">
      <h3 class="panel-title">{{ t('paneShortcuts') }}</h3>
      <p class="setting-description mb-6">{{ t('shortcutsDescription') }}</p>
    </div>
    <div class="shortcuts-list">
      <!-- General Shortcuts -->
      <div class="shortcut-group">
        <h4 class="group-title">{{ t('shortcutGroupGeneral') }}</h4>

        <div class="items-list">
          <div v-for="sc in generalShortcuts" :key="sc.id" class="shortcut-item">
            <span class="shortcut-label">{{ t(sc.labelKey) }}</span>
            <div class="shortcut-keys">
              <kbd v-for="key in sc.keys" :key="key">{{ key }}</kbd>
            </div>
          </div>
        </div>
      </div>

      <!-- Editor Shortcuts -->
      <div class="shortcut-group">
        <h4 class="group-title">{{ t('shortcutGroupEditor') }}</h4>

        <div class="items-list">
          <div v-for="sc in editorShortcuts" :key="sc.id" class="shortcut-item">
            <span class="shortcut-label">{{ t(sc.labelKey) }}</span>
            <div class="shortcut-keys">
              <kbd v-for="key in sc.keys" :key="key">{{ key }}</kbd>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="shortcut-hint">
      <p>
        <strong class="hint-label">{{ t('shortcutTooltip') }}:</strong>
        {{ t('shortcutsCustomizationHint') }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
const { t } = useI18n();

const generalShortcuts = [
  { id: 'new-note', labelKey: 'newNote', keys: ['Ctrl', 'N'] },
  { id: 'preferences', labelKey: 'menu.file.preferences', keys: ['Ctrl', ','] },
];

const editorShortcuts = [
  { id: 'save', labelKey: 'menu.file.save', keys: ['Ctrl', 'S'] },
];
</script>

<style scoped>
.shortcut-settings {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.mb-6 {
  margin-bottom: 1rem;
}

.shortcuts-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.shortcut-group {
  padding: 1rem;
  border-radius: 12px;
  background: var(--bg-secondary, #f8f9fa);
  border: 1px solid var(--border-color, #e0e0e0);
}

.group-title {
  margin: 0 0 0.75rem 0;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary, #666);
}

.items-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.shortcut-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.shortcut-label {
  font-size: 0.9rem;
  color: var(--text-primary);
}

.shortcut-keys {
  display: flex;
  gap: 0.25rem;
}

kbd {
  min-width: 2.2em;
  padding: 0.25rem 0.5rem;
  text-align: center;
  display: inline-block;
  font-family: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1;
  color: var(--text-primary);
  background: var(--bg-primary, white);
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 4px;
  box-shadow: 0 1px 1px rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease;
}

.shortcut-item:hover kbd {
  border-color: var(--primary-color);
  color: var(--primary-color);
  transform: translateY(-1px);
}

.shortcut-hint {
  margin-top: 1.5rem;
  padding: 1rem;
  background: rgba(var(--primary-rgb, 74, 144, 226), 0.05);
  border: 1px solid rgba(var(--primary-rgb, 74, 144, 226), 0.1);
  border-radius: 10px;
  color: var(--text-primary);
  font-size: 0.85rem;
}

.hint-label {
  font-weight: 700;
  color: var(--primary-color, #4a90e2);
}
</style>
