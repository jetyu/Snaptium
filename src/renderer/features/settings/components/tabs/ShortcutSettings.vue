<template>
  <div class="shortcut-settings">
    <div class="section-header">
      <h3 class="text-xl font-semibold mb-2 text-[var(--text-primary)]">{{ t('paneShortcuts') }}</h3>
      <p class="text-sm text-[var(--text-muted)] mb-6">{{ t('shortcutsDescription') }}</p>
    </div>

    <div class="shortcuts-list space-y-4">
      <!-- General Shortcuts -->
      <div class="shortcut-group p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]">
        <h4 class="text-sm font-medium uppercase tracking-wider text-[var(--text-muted)] mb-4">{{
          t('shortcutGroupGeneral') }}</h4>

        <div class="space-y-3">
          <div v-for="sc in generalShortcuts" :key="sc.id" class="shortcut-item flex items-center justify-between">
            <span class="text-sm text-[var(--text-primary)]">{{ t(sc.labelKey) }}</span>
            <div class="shortcut-keys flex gap-1">
              <kbd v-for="key in sc.keys" :key="key"
                class="px-2 py-1 text-xs font-sans font-semibold rounded bg-[var(--bg-primary)] border border-[var(--border-color)] shadow-sm">
                {{ key }}
              </kbd>
            </div>
          </div>
        </div>
      </div>

      <!-- Editor Shortcuts -->
      <div class="shortcut-group p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]">
        <h4 class="text-sm font-medium uppercase tracking-wider text-[var(--text-muted)] mb-4">{{
          t('shortcutGroupEditor') }}</h4>

        <div class="space-y-3">
          <div v-for="sc in editorShortcuts" :key="sc.id" class="shortcut-item flex items-center justify-between">
            <span class="text-sm text-[var(--text-primary)]">{{ t(sc.labelKey) }}</span>
            <div class="shortcut-keys flex gap-1">
              <kbd v-for="key in sc.keys" :key="key"
                class="px-2 py-1 text-xs font-sans font-semibold rounded bg-[var(--bg-primary)] border border-[var(--border-color)] shadow-sm">
                {{ key }}
              </kbd>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
      <p class="text-sm text-blue-700 dark:text-blue-300">
        <span class="font-bold">{{ t('shortcutTooltip') }}:</span> {{ t('shortcutsCustomizationHint') }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
const { t } = useI18n();

const generalShortcuts = [
  { id: 'new-note', labelKey: 'newNote', keys: ['Ctrl', 'N'] },
  { id: 'search', labelKey: 'searchPlaceholder', keys: ['Ctrl', 'F'] },
  { id: 'preferences', labelKey: 'menu.file.preferences', keys: ['Ctrl', ','] },
];

const editorShortcuts = [
  { id: 'save', labelKey: 'menu.file.save', keys: ['Ctrl', 'S'] },
  { id: 'bold', labelKey: 'toolbar.bold', keys: ['Ctrl', 'B'] },
  { id: 'italic', labelKey: 'toolbar.italic', keys: ['Ctrl', 'I'] },
];
</script>

<style scoped>
kbd {
  min-width: 2.5em;
  text-align: center;
  display: inline-block;
  color: var(--text-primary);
}

.shortcut-item:hover .shortcut-keys kbd {
  border-color: var(--primary-color);
  color: var(--primary-color);
}
</style>
