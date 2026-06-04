<template>
  <div class="notebook-dashboard">
    <div class="dashboard-content">
      <header class="dashboard-header">
        <div class="title-section icon-text">
          <NotebookVisualIcon
            :icon-color="currentNotebook?.iconColor"
            :icon-size="22"
            :box-size="30"
          />
          <h1>{{ notebookName }}</h1>
        </div>
        <div class="actions">
          <button class="action-button icon-text" @click="createNote(activeNotebookId)">
            <Plus theme="outline" :size="15" />
            {{ $t("workspace.dashboard.newNoteInThisNotebook") }}
          </button>
        </div>
      </header>

      <section class="stats-grid">
        <div class="stat-card">
          <span class="stat-label">{{
            $t("workspace.dashboard.totalNotes")
          }}</span>
          <span class="stat-value">{{ notebookNotes.length }}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">{{
            $t("workspace.dashboard.subNotebooks")
          }}</span>
          <span class="stat-value">{{ subNotebooks.length }}</span>
        </div>
      </section>

      <section v-if="subNotebooks.length > 0" class="notebooks-section">
        <h2>{{ $t("notebookDashboardSubNotebooks") }}</h2>
        <div class="notebooks-grid">
          <div v-for="nb in subNotebooks" :key="nb.id" class="notebook-card icon-text" @click="selectNotebook(nb.id)">
            <NotebookVisualIcon :icon-color="nb.iconColor" :icon-size="13" :box-size="18" />
            <div class="notebook-info">
              <span class="notebook-name" :title="nb.name">{{ nb.name }}</span>
              <span class="notebook-meta">{{ formatDate(nb.updatedAt, locale) }}</span>
            </div>
          </div>
        </div>
      </section>

      <section class="notes-section">
        <h2>{{ $t("workspace.dashboard.notesList") }}</h2>
        <div v-if="notebookNotes.length > 0" class="notes-list">
          <div v-for="note in notebookNotes" :key="note.id" class="note-card icon-text" @click="selectNote(note.id)">
            <Notes theme="outline" :size="16" />
            <div class="note-info">
              <span class="note-title" :title="note.title">{{ note.title }}</span>
              <span class="note-date">{{ formatDate(note.updatedAt, locale) }}</span>
            </div>
          </div>
        </div>
        <div v-else class="empty-notes">
          <p>{{ $t("workspace.dashboard.noNotes") }}</p>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useWorkspace } from "@renderer/features/workspace";
import { useI18n } from "vue-i18n";
import { formatDate } from "@renderer/core/utils/date.utils";
import { Plus, Notes } from '@icon-park/vue-next';
import NotebookVisualIcon from './NotebookVisualIcon.vue';

function compareNodeOrder(left: { order: number; createdAt: number; id: string }, right: { order: number; createdAt: number; id: string }) {
  if (left.order !== right.order) {
    return left.order - right.order;
  }

  if (left.createdAt !== right.createdAt) {
    return left.createdAt - right.createdAt;
  }

  return left.id.localeCompare(right.id);
}

const { activeNotebookId, notebooks, notes, selectNote, createNote, selectNotebook } =
  useWorkspace();

const { locale } = useI18n();

const currentNotebook = computed(() =>
  notebooks.value.find((nb) => nb.id === activeNotebookId.value)
);

const notebookName = computed(() => currentNotebook.value?.name || "");

const subNotebooks = computed(() =>
  notebooks.value
    .filter((nb) => nb.parentId === activeNotebookId.value)
    .sort(compareNodeOrder)
);

const notebookNotes = computed(() =>
  notes.value
    .filter((n) => n.parentId === activeNotebookId.value)
    .sort(compareNodeOrder)
);
</script>

<style scoped>
.notebook-dashboard {
  flex: 1;
  overflow-y: auto;
  background: var(--panel);
  padding: 32px;
  display: flex;
  justify-content: center;
}

.dashboard-content {
  width: 100%;
  max-width: 800px;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.title-section h1 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text);
  line-height: 1.2;
}

.actions .action-button {
  padding: 8px 16px;
  font-size: 0.7rem;
  min-height: 34px;
}

.actions .action-button:hover:not(:disabled) {
  background: var(--panel-hover);
  border-color: var(--panel-border);
  color: var(--text);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
}

.stat-card {
  background: var(--panel);
  padding: 16px;
  border-radius: var(--radius);
  border: 1px solid var(--panel-border);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-label {
  font-size: 0.85rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-value {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text);
}

.notes-section h2,
.notebooks-section h2 {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--text);
}

.notes-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 10px;
}

.note-card {
  background: var(--panel);
  padding: 16px;
  border-radius: var(--radius);
  border: 1px solid var(--panel-border);
  cursor: pointer;
  transition: all 0.2s;
}

.note-card:hover {
  border-color: var(--accent);
  background: var(--panel-hover);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.note-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.note-title {
  font-weight: 500;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.note-date {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.notebooks-section {
  margin-bottom: 32px;
}

.notebooks-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.notebook-card {
  background: var(--panel);
  padding: 12px 16px;
  border-radius: var(--radius);
  border: 1px solid var(--panel-border);
  cursor: pointer;
  transition: all 0.2s;
}

.notebook-card:hover {
  border-color: var(--accent);
  background: var(--panel-hover);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.notebook-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.notebook-name {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.notebook-meta {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.empty-notes {
  text-align: center;
  padding: 40px;
  background: var(--panel);
  border-radius: var(--radius);
  border: 2px dashed var(--panel-border);
  color: var(--text-muted);
}
</style>
