<template>
  <aside class="sidebar" @contextmenu.prevent="openRootMenu">
    <div class="sidebar-header">
      <span class="sidebar-title">{{ $t("labelNoteList") }}</span>
      <button
        class="btn-new-note"
        :title="$t('newNote')"
        @click="openCreateButtonMenu"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M8 2v12M2 8h12"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
      </button>
    </div>

    <ul v-if="treeEntries.length > 0" class="note-list workspace-tree">
      <li
        v-for="entry in treeEntries"
        :key="entry.id"
        class="workspace-row"
        :class="{
          active:
            entry.kind === 'note'
              ? entry.id === activeNoteId
              : entry.id === activeNotebookId,
          'workspace-row--notebook': entry.kind === 'notebook',
          'workspace-row--note': entry.kind === 'note',
          'workspace-row--editing': isEditing(entry),
        }"
        :style="{ '--tree-depth': entry.depth }"
        @click="
          entry.kind === 'note'
            ? selectNote(entry.id)
            : selectNotebook(entry.id)
        "
        @contextmenu.prevent.stop="
          entry.kind === 'note'
            ? openNoteMenu(entry.item)
            : openNotebookMenu(entry.item)
        "
      >
        <div class="workspace-row__icon">
          <NoteModeIcon
            v-if="entry.kind === 'note' && entry.item.locked"
            name="lockedIcon"
          />
          <NoteModeIcon
            v-else-if="entry.kind === 'notebook'"
            name="notebookIcon"
          />
          <NoteModeIcon v-else name="noteIcon" />
        </div>
        <div class="workspace-row__content">
          <input
            v-if="isEditing(entry)"
            ref="renameInput"
            v-model="renameDraft"
            class="workspace-row__rename-input"
            @click.stop
            @keydown.enter.prevent="commitRename"
            @keydown.esc.prevent="cancelRename"
            @blur="commitRename"
          />
          <template v-else>
            <span class="workspace-row__title">{{
              entry.kind === "notebook" ? entry.item.name : entry.item.title
            }}</span>
          </template>
        </div>
      </li>
    </ul>

    <div v-else class="sidebar-empty">
      <p>{{ $t("createFirstNoteOrNotebook") }}</p>
      <div class="empty-actions">
        <button class="btn-create-first" @click="createNote()">
          {{ $t("newNote") }}
        </button>
        <button class="btn-create-first secondary" @click="createNotebook()">
          {{ $t("contextMenu.newNotebook") }}
        </button>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useWorkspace } from "@renderer/features/workspace";
import type { Note, Notebook } from "../store/workspace.store";
import { useWorkspaceContextMenu } from "../composables/useWorkspaceContextMenu";
import NoteModeIcon from "@renderer/components/common/NoteModeIcon.vue";

type WorkspaceTreeEntry =
  | { id: string; depth: number; kind: "notebook"; item: Notebook }
  | { id: string; depth: number; kind: "note"; item: Note };

type RenameTarget =
  | { id: string; kind: "note" }
  | { id: string; kind: "notebook" }
  | null;

const {
  notes,
  notebooks,
  activeNoteId,
  activeNotebookId,
  selectNote,
  selectNotebook,
  createNote,
  createNotebook,
  showNoteInFolder,
  deleteNote,
  deleteNotebook,
  renameNote,
  renameNotebook,
  toggleNodeLock,
} = useWorkspace();

const { t, locale } = useI18n();
const renameTarget = ref<RenameTarget>(null);
const renameDraft = ref("");
const renameInput = ref<HTMLInputElement | null>(null);
const isSubmittingRename = ref(false);

function focusRenameInput() {
  nextTick(() => {
    renameInput.value?.focus();
    renameInput.value?.select();
  });
}

function beginRenamingNote(note: Note) {
  selectNote(note.id);
  renameTarget.value = { id: note.id, kind: "note" };
  renameDraft.value = note.title;
  focusRenameInput();
}

function beginRenamingNotebook(notebook: Notebook) {
  selectNotebook(notebook.id);
  renameTarget.value = { id: notebook.id, kind: "notebook" };
  renameDraft.value = notebook.name;
  focusRenameInput();
}

function isEditing(entry: WorkspaceTreeEntry) {
  return (
    renameTarget.value?.id === entry.id &&
    renameTarget.value?.kind === entry.kind
  );
}

function cancelRename() {
  renameTarget.value = null;
  renameDraft.value = "";
}

watch(
  [activeNoteId, activeNotebookId],
  ([nextActiveNoteId, nextActiveNotebookId]) => {
    const target = renameTarget.value;

    if (!target) {
      return;
    }

    const isTargetStillActive =
      target.kind === "note"
        ? target.id === nextActiveNoteId
        : target.id === nextActiveNotebookId;

    if (!isTargetStillActive) {
      cancelRename();
    }
  }
);

async function commitRename() {
  const target = renameTarget.value;
  const nextName = renameDraft.value.trim();

  if (!target || isSubmittingRename.value) {
    return;
  }

  if (!nextName) {
    cancelRename();
    return;
  }

  isSubmittingRename.value = true;

  try {
    if (target.kind === "note") {
      await renameNote(target.id, nextName);
    } else {
      await renameNotebook(target.id, nextName);
    }
  } finally {
    isSubmittingRename.value = false;
    cancelRename();
  }
}

const { openCreateButtonMenu, openRootMenu, openNoteMenu, openNotebookMenu } =
  useWorkspaceContextMenu({
    t,
    createNote,
    createNotebook,
    showNoteInFolder,
    deleteNote,
    deleteNotebook,
    selectNote,
    selectNotebook,
    beginRenamingNote,
    beginRenamingNotebook,
    toggleNodeLock,
  });

const treeEntries = computed<WorkspaceTreeEntry[]>(() => {
  const notebookChildren = new Map<string | null, Notebook[]>();
  const noteChildren = new Map<string | null, Note[]>();

  for (const notebook of notebooks.value) {
    const key = notebook.parentId ?? null;
    const bucket = notebookChildren.get(key) ?? [];
    bucket.push(notebook);
    notebookChildren.set(key, bucket);
  }

  for (const note of notes.value) {
    const key = note.parentId ?? null;
    const bucket = noteChildren.get(key) ?? [];
    bucket.push(note);
    noteChildren.set(key, bucket);
  }

  const sortNotebooks = (items: Notebook[]) =>
    [...items].sort(
      (a, b) => a.createdAt - b.createdAt || a.name.localeCompare(b.name)
    );
  const sortNotes = (items: Note[]) =>
    [...items].sort(
      (a, b) => a.createdAt - b.createdAt || a.updatedAt - b.updatedAt
    );
  const entries: WorkspaceTreeEntry[] = [];

  const visit = (parentId: string | null, depth: number) => {
    for (const notebook of sortNotebooks(
      notebookChildren.get(parentId) ?? []
    )) {
      entries.push({
        id: notebook.id,
        depth,
        kind: "notebook",
        item: notebook,
      });
      visit(notebook.id, depth + 1);
    }

    for (const note of sortNotes(noteChildren.get(parentId) ?? [])) {
      entries.push({ id: note.id, depth, kind: "note", item: note });
    }
  };

  visit(null, 0);
  return entries;
});
</script>

<style scoped>
.workspace-tree {
  padding: 6px 0;
}

.workspace-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  padding-left: calc(14px + (var(--tree-depth, 0) * 18px));
  cursor: pointer;
  border-left: 3px solid transparent;
  transition: background 0.12s, border-color 0.12s;
}

.workspace-row:hover {
  background: var(--panel-hover);
}

.workspace-row.active {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  border-left-color: var(--accent);
}

.workspace-row__icon {
  flex: 0 0 auto;
  font-size: 14px;
  line-height: 1;
}

.workspace-row__content {
  min-width: 0;
  display: flex;
  flex: 1;
  flex-direction: row;
  align-items: center;
  gap: 6px;
}

.workspace-row__title {
  font-size: 0.88rem;
  font-weight: 500;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.workspace-row.active .workspace-row__title {
  color: var(--accent-hover);
}

.workspace-row__meta {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.workspace-row--notebook .workspace-row__content {
  flex-direction: row;
  align-items: center;
}

.workspace-row__rename-input {
  width: 100%;
  min-width: 0;
  padding: 4px 6px;
  border: 1px solid color-mix(in srgb, var(--accent) 55%, transparent);
  border-radius: 6px;
  background: var(--panel);
  color: var(--text);
  font: inherit;
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
