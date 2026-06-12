<template>
  <div class="shortcuts-panel">
    <div class="panel-header">
      <h2>{{ t('shortcuts.title') }}</h2>
      <div class="header-actions">
        <button class="action-button" @click="handleReset">
          {{ t('shortcuts.resetToDefaults') }}
        </button>
      </div>
    </div>

    <CommandList @add-shortcut="handleAddShortcut" @remove-shortcut="handleRemoveShortcut" />

    <!-- 添加快捷键对话框 -->
    <div v-if="showAddDialog" class="dialog-overlay" @click="closeAddDialog">
      <div class="dialog" @click.stop>
        <div class="dialog-header">
          <h3>{{ t('shortcuts.addShortcut') }}</h3>
          <button class="close-button dialog-close-button" @click="closeAddDialog">
            ×
          </button>
        </div>
        <div class="dialog-body">
          <div class="form-group">
            <label>{{ t('shortcuts.command') }}</label>
            <div class="command-display">{{ selectedCommandId }}</div>
          </div>
          <div class="form-group">
            <label>{{ t('shortcuts.keybinding') }}</label>
            <ShortcutInput v-model="newShortcutKey" :has-conflict="conflicts.length > 0" @conflict="checkConflicts" />
          </div>
          <div v-if="conflicts.length > 0" class="conflict-warning">
            <p>{{ t('shortcuts.conflictWarning') }}</p>
            <ul>
              <li v-for="conflict in conflicts" :key="conflict.commandId">
                {{ conflict.commandId }} ({{ conflict.key }})
              </li>
            </ul>
          </div>
        </div>
        <div class="dialog-footer">
          <button class="action-button secondary" @click="closeAddDialog">
            {{ t('common.cancel') }}
          </button>
          <button class="action-button primary" :disabled="!newShortcutKey || conflicts.length > 0"
            @click="confirmAddShortcut">
            {{ t('common.confirm') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useShortcutsStore } from '../store/shortcuts.store';
import type { KeybindingConflict } from '../store/shortcuts.store';
import { createLogger } from '@renderer/features/logger';
import { getErrorMessage } from '@shared/utils/error.utils';
import CommandList from './CommandList.vue';
import ShortcutInput from './ShortcutInput.vue';

const { t } = useI18n();
const shortcutsStore = useShortcutsStore();
const shortcutsPanelLogger = createLogger('ShortcutsPanel');

const showAddDialog = ref(false);
const selectedCommandId = ref('');
const newShortcutKey = ref('');
const conflicts = ref<KeybindingConflict[]>([]);

function handleAddShortcut(commandId: string) {
  selectedCommandId.value = commandId;
  newShortcutKey.value = '';
  conflicts.value = [];
  showAddDialog.value = true;
}

async function handleRemoveShortcut(commandId: string, key: string) {
  try {
    await shortcutsStore.removeKeybinding(commandId, key);
  } catch (error) {
    shortcutsPanelLogger.error(`Failed to remove shortcut: ${getErrorMessage(error)}`);
  }
}

async function checkConflicts(key: string) {
  if (!key) {
    conflicts.value = [];
    return;
  }

  conflicts.value = await shortcutsStore.detectConflicts(key, selectedCommandId.value);
}

async function confirmAddShortcut() {
  if (!newShortcutKey.value || conflicts.value.length > 0) {
    return;
  }

  try {
    await shortcutsStore.addKeybinding(selectedCommandId.value, newShortcutKey.value);
    closeAddDialog();
  } catch (error) {
    shortcutsPanelLogger.error(`Failed to add shortcut: ${getErrorMessage(error)}`);
  }
}

function closeAddDialog() {
  showAddDialog.value = false;
  selectedCommandId.value = '';
  newShortcutKey.value = '';
  conflicts.value = [];
}

async function handleReset() {
  try {
    await shortcutsStore.resetToDefaults();
  } catch (error) {
    shortcutsPanelLogger.error(`Failed to reset shortcuts: ${getErrorMessage(error)}`);
  }
}
</script>

<style scoped>
.shortcuts-panel {
  display: block;
  background-color: var(--panel);
}

.panel-header {
  padding: 0 0 16px 0;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--panel-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.panel-header h2 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text);
}

.header-actions {
  display: flex;
  gap: 12px;
}

/* 对话框样式 */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--dialog-overlay-bg);
  backdrop-filter: var(--dialog-overlay-backdrop-filter);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background-color: var(--panel);
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  border: 1px solid var(--panel-border);
  overflow: hidden;
}

.dialog-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--panel-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--panel-hover);
}

.dialog-header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text);
}

.close-button {
  color: var(--text-muted);
  font-size: 0;
}

.close-button::before {
  content: "×";
  font-size: 22px;
  line-height: 1;
}

.dialog-body {
  padding: 24px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-muted);
}

.command-display {
  padding: 10px 14px;
  background-color: var(--bg);
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 0.85rem;
  color: var(--text);
}

.conflict-warning {
  padding: 12px 16px;
  background-color: color-mix(in srgb, var(--danger) 10%, transparent);
  border: 1px solid var(--danger);
  border-radius: 8px;
  font-size: 0.85rem;
  margin-top: 16px;
}

.conflict-warning p {
  margin: 0 0 8px 0;
  font-weight: 600;
  color: var(--danger);
}

.conflict-warning ul {
  margin: 0;
  padding-left: 20px;
  color: var(--danger);
}

.dialog-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--panel-border);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  background: var(--panel-hover);
}

</style>

