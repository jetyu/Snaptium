<template>
  <div class="shortcut-settings">
    <h3 class="panel-title">{{ t('shortcuts.title') }}</h3>

    <div class="shortcuts-container">
      <div v-for="[category, cmds] in shortcutsStore.commandsByCategory" :key="category" class="category-section">
        <h4 class="category-title">{{ t(`shortcuts.category.${category}`) }}</h4>
        <div class="shortcuts-list">
          <div v-for="command in cmds" :key="command.id" class="shortcut-row">
            <span class="command-name">{{ t(`commands.${command.id}`) }}</span>
            <div class="shortcut-keys">
              <template v-if="getKeybindingsForCommand(command.id).length > 0">
                <div v-for="(kb, index) in getKeybindingsForCommand(command.id)" :key="index" class="key-group">
                  <kbd class="key-badge">{{ formatKeybinding(kb.key) }}</kbd>
                  <button class="key-remove" type="button" @click="handleRemoveShortcut(command.id, kb.key)">
                    ×
                  </button>
                </div>
              </template>
              <button class="key-add" type="button" @click="handleAddShortcut(command.id)">
                +
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="shortcuts-footer">
      <button class="action-button" @click="handleReset">
        {{ t('shortcuts.resetToDefaults') }}
      </button>
    </div>

    <!-- 添加快捷键对话框 -->
    <div v-if="showAddDialog" ref="overlayRef" class="dialog-overlay" @click="closeAddDialog">
      <div ref="dialogRef" class="dialog" :style="dialogStyle" @click.stop>
        <div ref="dragHandleRef" class="dialog-header dialog-drag-handle" @pointerdown="onDragHandlePointerDown">
          <h3>{{ t('shortcuts.addShortcut') }}</h3>
          <button class="close-button dialog-close-button" @click="closeAddDialog">×</button>
        </div>
        <div class="dialog-body">
          <div class="shortcut-form-group">
            <label>{{ t('shortcuts.command') }}</label>
            <div class="command-display">{{ t(`commands.${selectedCommandId}`) }}</div>
          </div>
          <div class="shortcut-form-group">
            <label>{{ t('shortcuts.keybinding') }}</label>
            <ShortcutInput v-model="newShortcutKey" :has-conflict="conflicts.length > 0" @conflict="checkConflicts" />
          </div>
          <div v-if="conflicts.length > 0" class="conflict-warning">
            <p>{{ t('shortcuts.conflictWarning') }}</p>
            <ul>
              <li v-for="conflict in conflicts" :key="conflict.commandId">
                {{ t(`commands.${conflict.commandId}`) }} ({{ conflict.key }})
              </li>
            </ul>
          </div>
        </div>
        <div class="dialog-footer">
          <button class="action-button secondary" @click="closeAddDialog">
            {{ t('button.cancel') }}
          </button>
          <button class="action-button primary" :disabled="!newShortcutKey || conflicts.length > 0"
            @click="confirmAddShortcut">
            {{ t('button.confirm') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useShortcutsStore } from '@renderer/features/shortcuts';
import type { KeybindingConflict } from '@renderer/features/shortcuts/store/shortcuts.store';
import { createLogger } from '@renderer/features/logger';
import { useDraggableDialog } from '@renderer/core/composables/useDraggableDialog';
import { getErrorMessage } from '@shared/utils/error.utils';
import ShortcutInput from '@renderer/features/shortcuts/components/ShortcutInput.vue';
import { formatKeybinding } from '@renderer/core/utils/formatKeybinding.utils';

const { t } = useI18n();
const shortcutsStore = useShortcutsStore();
const shortcutSettingsLogger = createLogger('ShortcutSettings');

const showAddDialog = ref(false);
const overlayRef = ref<HTMLElement | null>(null);
const dialogRef = ref<HTMLElement | null>(null);
const dragHandleRef = ref<HTMLElement | null>(null);
const selectedCommandId = ref('');
const newShortcutKey = ref('');
const conflicts = ref<KeybindingConflict[]>([]);
const { dialogStyle, onDragHandlePointerDown } = useDraggableDialog({
  isOpen: showAddDialog,
  overlayRef,
  dialogRef,
  handleRef: dragHandleRef,
});

onMounted(async () => {
  await shortcutsStore.initialize();
});

function getKeybindingsForCommand(commandId: string) {
  return shortcutsStore.getKeybindingsForCommand(commandId);
}

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
    shortcutSettingsLogger.error(`Failed to remove shortcut: ${getErrorMessage(error)}`);
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
  if (!newShortcutKey.value || conflicts.value.length > 0) return;
  try {
    await shortcutsStore.addKeybinding(selectedCommandId.value, newShortcutKey.value);
    closeAddDialog();
  } catch (error) {
    shortcutSettingsLogger.error(`Failed to add shortcut: ${getErrorMessage(error)}`);
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
    shortcutSettingsLogger.error(`Failed to reset shortcuts: ${getErrorMessage(error)}`);
  }
}
</script>

<style scoped>
.shortcuts-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.shortcuts-footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 1rem;
  margin-top: 0.5rem;
  border-top: 1px solid var(--border-muted);
}

.category-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.category-title {
  margin: 0 0 0.5rem 0;
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-tertiary);
}

.shortcuts-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
}

.shortcut-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-height: 48px;
  padding: 0.5rem 1rem;
  border: 1px solid var(--border-muted);
  border-radius: 10px;
  background: var(--surface-subtle);
  transition: border-color 0.2s ease;
}

.shortcut-row:hover {
  border-color: var(--border-strong);
}

.command-name {
  font-size: 0.9rem;
  color: var(--text-primary);
  font-weight: 500;
}

.shortcut-keys {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.key-group {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.key-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  background: linear-gradient(180deg, var(--surface-raised) 0%, var(--surface-soft) 100%);
  border: 1px solid var(--input-border);
  border-bottom-width: 2px;
  border-radius: 6px;
  font-family: 'Segoe UI', system-ui, sans-serif;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-primary);
  box-shadow: var(--shadow-soft);
  white-space: nowrap;
}

.key-remove {
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-disabled);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s ease;
}

.key-remove:hover {
  background-color: var(--status-danger-bg);
  color: var(--status-danger-text);
}

.key-add {
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px dashed var(--input-border);
  background: transparent;
  border-radius: 6px;
  color: var(--text-disabled);
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.key-add:hover {
  border-color: var(--input-border-focus);
  color: var(--accent-hover);
  background-color: color-mix(in srgb, var(--accent) 8%, transparent);
}

/* 对话框 */
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: var(--dialog-overlay-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: var(--dialog-overlay-backdrop-filter);
}

.dialog {
  background-color: var(--surface-raised);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  width: 90%;
  max-width: 480px;
  box-shadow: var(--shadow-lg);
}

.dialog-header {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dialog-header h3 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
}

.close-button {
  color: var(--text-disabled);
  font-size: 0;
}

.close-button::before {
  content: "×";
  font-size: 22px;
  line-height: 1;
}

.dialog-body {
  padding: 1.5rem;
}

.shortcut-form-group {
  margin-bottom: 1.25rem;
}

.shortcut-form-group:last-child {
  margin-bottom: 0;
}

.shortcut-form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
}

.command-display {
  padding: 0.75rem 1rem;
  background-color: var(--surface-subtle);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 0.875rem;
  color: var(--text-tertiary);
}

.conflict-warning {
  padding: 1rem;
  background-color: var(--status-warning-bg);
  border: 1px solid var(--status-warning-border);
  border-radius: 8px;
  font-size: 0.875rem;
}

.conflict-warning p {
  margin: 0 0 0.5rem 0;
  font-weight: 600;
  color: var(--status-warning-text);
}

.conflict-warning ul {
  margin: 0;
  padding-left: 1.25rem;
  color: var(--status-warning-text);
}

.dialog-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

</style>

