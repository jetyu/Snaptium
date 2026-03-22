<template>
  <aside class="sidebar" @contextmenu.prevent="openRootMenu">
    <div class="sidebar-header">
      <span class="sidebar-title">{{ $t('notes') }}</span>
      <button class="btn-new-note" :title="$t('newNote')" @click="openCreateButtonMenu">
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
          @contextmenu.prevent.stop="openNotebookMenu(notebook)"
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
        @contextmenu.prevent.stop="openNoteMenu(note)"
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
import { useWorkspace } from '@renderer/features/workspace';
import { useWorkspaceContextMenu } from '../composables/useWorkspaceContextMenu';

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
const {
  openCreateButtonMenu,
  openRootMenu,
  openNoteMenu,
  openNotebookMenu,
} = useWorkspaceContextMenu({
  t,
  createNote,
  createNotebook,
  selectNote,
});

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
