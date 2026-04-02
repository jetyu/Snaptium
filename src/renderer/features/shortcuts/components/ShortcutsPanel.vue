<template>
  <div class="shortcuts-panel">
    <div class="panel-header">
      <h2>{{ t('shortcuts.title') }}</h2>
      <div class="header-actions">
        <button
          class="action-button"
          @click="handleReset"
        >
          {{ t('shortcuts.resetToDefaults') }}
        </button>
      </div>
    </div>

    <CommandList
      @add-shortcut="handleAddShortcut"
      @remove-shortcut="handleRemoveShortcut"
    />

    <!-- 添加快捷键对话框 -->
    <div
      v-if="showAddDialog"
      class="dialog-overlay"
      @click="closeAddDialog"
    >
      <div
        class="dialog"
        @click.stop
      >
        <div class="dialog-header">
          <h3>{{ t('shortcuts.addShortcut') }}</h3>
          <button
            class="close-button"
            @click="closeAddDialog"
          >
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
            <ShortcutInput
              v-model="newShortcutKey"
              :has-conflict="conflicts.length > 0"
              @conflict="checkConflicts"
            />
          </div>
          <div
            v-if="conflicts.length > 0"
            class="conflict-warning"
          >
            <p>{{ t('shortcuts.conflictWarning') }}</p>
            <ul>
              <li
                v-for="conflict in conflicts"
                :key="conflict.commandId"
              >
                {{ conflict.commandId }} ({{ conflict.key }})
              </li>
            </ul>
          </div>
        </div>
        <div class="dialog-footer">
          <button
            class="button button-secondary"
            @click="closeAddDialog"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            class="button button-primary"
            :disabled="!newShortcutKey || conflicts.length > 0"
            @click="confirmAddShortcut"
          >
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
import CommandList from './CommandList.vue';
import ShortcutInput from './ShortcutInput.vue';

const { t } = useI18n();
const shortcutsStore = useShortcutsStore();

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
    console.error('Failed to remove shortcut:', error);
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
    console.error('Failed to add shortcut:', error);
  }
}

function closeAddDialog() {
  showAddDialog.value = false;
  selectedCommandId.value = '';
  newShortcutKey.value = '';
  conflicts.value = [];
}

async function handleReset() {
  if (!confirm(t('shortcuts.resetConfirm'))) {
    return;
  }

  try {
    await shortcutsStore.resetToDefaults();
  } catch (error) {
    console.error('Failed to reset shortcuts:', error);
  }
}
</script>

<style scoped>
.shortcuts-panel {
  display: block;
  background-color: var(--panel-bg, #fff);
}

.panel-header {
  padding: 0 0 16px 0;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--border-color, #e0e0e0);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.panel-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-color, #333);
}

.header-actions {
  display: flex;
  gap: 12px;
}

.action-button {
  padding: 8px 16px;
  border: 1px solid var(--border-color, #ddd);
  background-color: var(--button-bg, #fff);
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-button:hover {
  background-color: var(--button-hover-bg, #f5f5f5);
}

/* 对话框样式 */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background-color: var(--dialog-bg, #fff);
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.dialog-header {
  padding: 20px;
  border-bottom: 1px solid var(--border-color, #e0e0e0);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dialog-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.close-button {
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  background: transparent;
  font-size: 24px;
  color: var(--text-secondary, #999);
  cursor: pointer;
  transition: color 0.2s;
}

.close-button:hover {
  color: var(--text-color, #333);
}

.dialog-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-color, #333);
}

.command-display {
  padding: 8px 12px;
  background-color: var(--input-disabled-bg, #f5f5f5);
  border: 1px solid var(--border-color, #ddd);
  border-radius: 4px;
  font-family: monospace;
  font-size: 13px;
  color: var(--text-secondary, #666);
}

.conflict-warning {
  padding: 12px;
  background-color: var(--warning-bg, #fff3cd);
  border: 1px solid var(--warning-border, #ffc107);
  border-radius: 4px;
  font-size: 13px;
}

.conflict-warning p {
  margin: 0 0 8px 0;
  font-weight: 500;
  color: var(--warning-text, #856404);
}

.conflict-warning ul {
  margin: 0;
  padding-left: 20px;
  color: var(--warning-text, #856404);
}

.dialog-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--border-color, #e0e0e0);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.button {
  padding: 8px 20px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.button-secondary {
  background-color: var(--button-secondary-bg, #f5f5f5);
  color: var(--text-color, #333);
}

.button-secondary:hover:not(:disabled) {
  background-color: var(--button-secondary-hover-bg, #e0e0e0);
}

.button-primary {
  background-color: var(--primary-color, #007bff);
  color: #fff;
}

.button-primary:hover:not(:disabled) {
  background-color: var(--primary-hover-color, #0056b3);
}
</style>
