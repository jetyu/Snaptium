<template>
  <aside class="sidebar" @contextmenu.prevent="handleRootContextMenu">
    <div class="sidebar-header">
      <span class="sidebar-title">{{ $t('notes') }}</span>
      <button class="btn-new-note" :title="$t('newNote')" @click="openCreateMenu">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>

    <section v-if="notebooks.length > 0" class="notebook-section">
      <p class="section-label">{{ $t('contextMenu.newNotebook') }}</p>
      <ul class="notebook-list">
        <li
          v-for="notebook in notebooks"
          :key="notebook.id"
          class="notebook-item"
          @contextmenu.prevent.stop="handleNodeContextMenu('folder', notebook)"
        >
          <span class="notebook-icon">📁</span>
          <span class="notebook-name">{{ notebook.name }}</span>
        </li>
      </ul>
    </section>

    <ul class="note-list">
      <li
        v-for="note in sortedNotes"
        :key="note.id"
        class="note-item"
        :class="{ active: note.id === activeNoteId }"
        @click="selectNote(note.id)"
        @contextmenu.prevent.stop="handleNodeContextMenu('file', note)"
      >
        <span class="note-item-title">{{ note.title }}</span>
        <span class="note-item-date">{{ formatDate(note.updatedAt) }}</span>
      </li>
    </ul>

    <div v-if="notes.length === 0" class="sidebar-empty">
      <p>{{ $t('noNotes') || '还没有笔记' }}</p>
      <div class="empty-actions">
        <button class="btn-create-first" @click="createNote()">{{ $t('newNote') }}</button>
        <button class="btn-create-first secondary" @click="createNotebook()">{{ $t('contextMenu.newNotebook') }}</button>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { logger } from '@renderer/features/logger';
import { useWorkspace } from '@renderer/features/workspace';
import type { Note, Notebook } from '@renderer/features/workspace/store/workspace.store';

const {
  notes,
  notebooks,
  sortedNotes,
  activeNoteId,
  selectNote,
  createNote,
  createNotebook,
} = useWorkspace();

const { t, locale } = useI18n();

type WorkspaceEntry = Note | Notebook;
type WorkspaceEntryType = 'file' | 'folder';
type WorkspaceAction =
  | 'create-note'
  | 'create-notebook'
  | 'rename'
  | 'delete'
  | 'toggle-lock'
  | 'show-in-folder'
  | 'properties';

const labels = {
  'contextMenu.newNote': t('contextMenu.newNote'),
  'contextMenu.newNotebook': t('contextMenu.newNotebook'),
  'contextMenu.rename': t('contextMenu.rename'),
  'contextMenu.delete': t('contextMenu.delete'),
  'contextMenu.lock': t('contextMenu.lock'),
  'contextMenu.showInFolder': t('contextMenu.showInFolder'),
  'contextMenu.properties': t('contextMenu.properties'),
};

async function showContextMenu(items: Array<{ action?: WorkspaceAction; labelKey?: string; type?: 'normal' | 'separator' }>) {
  if (!window.electronAPI?.workspace) {
    logger.warn('electronAPI.workspace not available, cannot show native workspace context menu.');
    return null;
  }

  return window.electronAPI.workspace.showContextMenu({
    labels,
    items: items.map((item) => ({
      action: item.action ?? 'noop',
      labelKey: item.labelKey,
      type: item.type ?? 'normal',
    })),
  }) as Promise<WorkspaceAction | null>;
}

function getTargetParentId(type: WorkspaceEntryType, entry: WorkspaceEntry): string | null {
  if (type === 'folder') {
    return entry.id;
  }

  return entry.parentId ?? null;
}

async function runAction(action: WorkspaceAction | null, parentId: string | null = null) {
  switch (action) {
    case 'create-note':
      await createNote(parentId);
      break;
    case 'create-notebook':
      await createNotebook(parentId);
      break;
    case 'rename':
    case 'delete':
    case 'toggle-lock':
    case 'show-in-folder':
    case 'properties':
      logger.info(`Workspace context menu action selected: ${action}`);
      break;
    default:
      break;
  }
}

async function openCreateMenu() {
  const action = await showContextMenu([
    { action: 'create-note', labelKey: 'contextMenu.newNote' },
    { action: 'create-notebook', labelKey: 'contextMenu.newNotebook' },
  ]);

  await runAction(action, null);
}

async function handleRootContextMenu() {
  const action = await showContextMenu([
    { action: 'create-note', labelKey: 'contextMenu.newNote' },
    { action: 'create-notebook', labelKey: 'contextMenu.newNotebook' },
    { type: 'separator' },
    { action: 'properties', labelKey: 'contextMenu.properties' },
  ]);

  await runAction(action, null);
}

async function handleNodeContextMenu(type: WorkspaceEntryType, entry: WorkspaceEntry) {
  if (type === 'file') {
    selectNote(entry.id);
  }

  const action = await showContextMenu([
    { action: 'create-note', labelKey: 'contextMenu.newNote' },
    { action: 'create-notebook', labelKey: 'contextMenu.newNotebook' },
    { type: 'separator' },
    { action: 'rename', labelKey: 'contextMenu.rename' },
    { action: 'delete', labelKey: 'contextMenu.delete' },
    { action: 'toggle-lock', labelKey: 'contextMenu.lock' },
    { action: 'show-in-folder', labelKey: 'contextMenu.showInFolder' },
    { action: 'properties', labelKey: 'contextMenu.properties' },
  ]);

  await runAction(action, getTargetParentId(type, entry));
}

function formatDate(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return t('justNow');
  if (minutes < 60) return t('minutesAgo', { n: minutes });
  if (hours < 24) return t('hoursAgo', { n: hours });
  if (days < 7) return t('daysAgo', { n: days });

  return new Date(ts).toLocaleDateString(locale.value, { month: 'short', day: 'numeric' });
}
</script>

<style scoped>
.notebook-section {
  padding: 8px 0 4px;
}

.section-label {
  margin: 0 0 8px;
  font-size: 12px;
  color: var(--color-text-secondary, #6b7280);
}

.notebook-list,
.note-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.notebook-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
}

.notebook-item:hover {
  background: rgba(59, 130, 246, 0.08);
}

.notebook-icon {
  font-size: 14px;
}

.notebook-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.secondary {
  background: transparent;
  border: 1px solid var(--color-border, #d1d5db);
}
</style>
