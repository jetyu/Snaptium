<template>
  <div class="command-list">
    <div class="command-list-body">
      <div
        v-for="[category, cmds] in shortcutsStore.commandsByCategory"
        :key="category"
        class="command-category"
      >
        <h3 class="category-title">{{ t(`shortcuts.category.${category}`) }}</h3>
        <div class="command-items">
          <div
            v-for="command in cmds"
            :key="command.id"
            class="command-item"
          >
            <div class="command-info">
              <div class="command-label">{{ t(`commands.${command.id}`) }}</div>
            </div>
            <div class="command-shortcuts">
              <div
                v-for="(kb, index) in getKeybindingsForCommand(command.id)"
                :key="index"
                class="shortcut-badge"
              >
                {{ kb.key }}
                <button
                  class="remove-shortcut"
                  type="button"
                  @click="handleRemoveShortcut(command.id, kb.key)"
                >
                  ×
                </button>
              </div>
              <button
                class="add-shortcut-button"
                type="button"
                @click="handleAddShortcut(command.id)"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useShortcutsStore } from '../store/shortcuts.store';

const { t } = useI18n();
const shortcutsStore = useShortcutsStore();

interface Emits {
  (e: 'add-shortcut', commandId: string): void;
  (e: 'remove-shortcut', commandId: string, key: string): void;
}

const emit = defineEmits<Emits>();

function getKeybindingsForCommand(commandId: string) {
  return shortcutsStore.getKeybindingsForCommand(commandId);
}

function handleAddShortcut(commandId: string) {
  emit('add-shortcut', commandId);
}

function handleRemoveShortcut(commandId: string, key: string) {
  emit('remove-shortcut', commandId, key);
}
</script>

<style scoped>
.command-list {
  display: block;
}

.command-list-body {
  display: block;
}

.command-category {
  margin-bottom: 20px;
}

.command-category:last-child {
  margin-bottom: 0;
}

.category-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 10px 0;
  color: var(--text-color, #333);
}

.command-items {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.command-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background-color: var(--item-bg, #f9f9f9);
  border-radius: 6px;
  transition: background-color 0.2s;
  min-height: 40px;
}

.command-item:hover {
  background-color: var(--item-hover-bg, #f0f0f0);
}

.command-info {
  flex: 1;
  min-width: 0;
}

.command-label {
  font-size: 0.875rem;
  color: var(--text-color, #333);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.command-shortcuts {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.shortcut-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 6px;
  background-color: var(--badge-bg, #e0e0e0);
  border-radius: 4px;
  font-family: monospace;
  font-size: 11px;
  color: var(--text-color, #333);
}

.remove-shortcut {
  padding: 0;
  width: 14px;
  height: 14px;
  border: none;
  background: transparent;
  color: var(--text-secondary, #999);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  transition: color 0.2s;
}

.remove-shortcut:hover {
  color: var(--error-color, #dc3545);
}

.add-shortcut-button {
  padding: 3px 10px;
  border: 1px dashed var(--border-color, #ddd);
  background: transparent;
  border-radius: 4px;
  font-size: 13px;
  color: var(--text-secondary, #999);
  cursor: pointer;
  transition: all 0.2s;
}

.add-shortcut-button:hover {
  border-color: #b6c0cc;
  color: #111827;
}
</style>
