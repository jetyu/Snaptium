<template>
  <aside class="sidebar" @click="closeCreateMenu">
    <div class="sidebar-header">
      <span class="sidebar-title">{{ $t('notes') }}</span>
      <div class="create-menu-wrapper" @click.stop>
        <button class="btn-new-note" :title="$t('newNote')" @click="toggleCreateMenu">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
        <div v-if="isCreateMenuOpen" class="create-menu">
          <button class="create-menu-item" @click="handleCreateNote">{{ $t('contextMenu.newNote') }}</button>
          <button class="create-menu-item" @click="handleCreateNotebook">{{ $t('contextMenu.newNotebook') }}</button>
        </div>
      </div>
    </div>

    <section v-if="notebooks.length > 0" class="notebook-section">
      <p class="section-label">{{ $t('contextMenu.newNotebook') }}</p>
      <ul class="notebook-list">
        <li v-for="notebook in notebooks" :key="notebook.id" class="notebook-item">
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
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useWorkspace } from '@renderer/features/workspace';

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
const isCreateMenuOpen = ref(false);

function toggleCreateMenu() {
  isCreateMenuOpen.value = !isCreateMenuOpen.value;
}

function closeCreateMenu() {
  isCreateMenuOpen.value = false;
}

async function handleCreateNote() {
  await createNote();
  closeCreateMenu();
}

async function handleCreateNotebook() {
  await createNotebook();
  closeCreateMenu();
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
.create-menu-wrapper {
  position: relative;
}

.create-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 148px;
  padding: 6px;
  border-radius: 10px;
  background: var(--color-surface, #fff);
  border: 1px solid var(--color-border, #e5e7eb);
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.12);
  z-index: 20;
}

.create-menu-item,
.btn-create-first.secondary {
  width: 100%;
}

.create-menu-item {
  display: block;
  padding: 8px 10px;
  border: none;
  background: transparent;
  text-align: left;
  border-radius: 8px;
  cursor: pointer;
}

.create-menu-item:hover {
  background: rgba(59, 130, 246, 0.08);
}

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
