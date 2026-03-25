<template>
  <div class="notebook-dashboard">
    <div class="dashboard-content">
      <header class="dashboard-header">
        <div class="title-section">
          <span class="icon">📓</span>
          <h1>{{ notebookName }}</h1>
        </div>
        <div class="actions">
          <button class="btn btn-primary" @click="createNote(activeNotebookId)">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 2v12M2 8h12"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
            {{ $t("notebookDashboardActionsNewNote") }}
          </button>
        </div>
      </header>

      <section class="stats-grid">
        <div class="stat-card">
          <span class="stat-label">{{
            $t("notebookDashboardStatsTotalNotes")
          }}</span>
          <span class="stat-value">{{ notebookNotes.length }}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">{{
            $t("notebookDashboardStatsLastModified")
          }}</span>
          <span class="stat-value">{{ lastModifiedStr }}</span>
        </div>
      </section>

      <section class="notes-section">
        <h2>{{ $t("notebookDashboardNotesList") }}</h2>
        <div v-if="notebookNotes.length > 0" class="notes-list">
          <div
            v-for="note in notebookNotes"
            :key="note.id"
            class="note-card"
            @click="selectNote(note.id)"
          >
            <span class="note-icon">📝</span>
            <div class="note-info">
              <span class="note-title">{{ note.title }}</span>
              <span class="note-date">{{ formatDate(note.updatedAt) }}</span>
            </div>
          </div>
        </div>
        <div v-else class="empty-notes">
          <p>{{ $t("notebookDashboardNoNotes") }}</p>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useWorkspace } from "@renderer/features/workspace";
import { useI18n } from "vue-i18n";

const { activeNotebookId, notebooks, notes, selectNote, createNote } =
  useWorkspace();

const { locale } = useI18n();

const currentNotebook = computed(() =>
  notebooks.value.find((nb) => nb.id === activeNotebookId.value)
);

const notebookName = computed(() => currentNotebook.value?.name || "");

const notebookNotes = computed(() =>
  notes.value
    .filter((n) => n.parentId === activeNotebookId.value)
    .sort((a, b) => b.updatedAt - a.updatedAt)
);

const lastModifiedNote = computed(() =>
  notebookNotes.value.length > 0
    ? notebookNotes.value[0]
    : currentNotebook.value
);

const lastModifiedStr = computed(() => {
  if (!lastModifiedNote.value) return "-";
  return formatDate(lastModifiedNote.value.updatedAt);
});

function formatDate(timestamp: number) {
  const date = new Date(timestamp);
  return date.toLocaleDateString(locale.value, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
</script>

<style scoped>
.notebook-dashboard {
  flex: 1;
  overflow-y: auto;
  background: var(--bg);
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

.title-section {
  display: flex;
  align-items: center;
  gap: 12px;
}

.title-section .icon {
  font-size: 2rem;
}

.title-section h1 {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: var(--text);
}

.btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: var(--radius);
  font-size: 0.7rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-primary {
  background: var(--accent);
  color: #fff;
}

.btn-primary:hover {
  background: var(--accent-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--accent) 30%, transparent);
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

.notes-section h2 {
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
  display: flex;
  align-items: flex-start;
  gap: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.note-card:hover {
  border-color: var(--accent);
  background: var(--panel-hover);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.note-icon {
  font-size: 1.2rem;
  margin-top: 2px;
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

.empty-notes {
  text-align: center;
  padding: 40px;
  background: var(--panel);
  border-radius: var(--radius);
  border: 2px dashed var(--panel-border);
  color: var(--text-muted);
}
</style>
