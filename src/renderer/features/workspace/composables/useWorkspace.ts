import { computed } from 'vue';
import { useWorkspaceStore } from '../store/workspace.store';

export function useWorkspace() {
  const store = useWorkspaceStore();

  const notes = computed(() => store.notes);
  const notebooks = computed(() => store.sortedNotebooks);
  const sortedNotes = computed(() => store.sortedNotes);
  const activeNote = computed(() => store.activeNote);
  const activeNoteId = computed(() => store.activeNoteId);
  const activeNotebookId = computed(() => store.activeNotebookId);

  return {
    notes,
    notebooks,
    sortedNotes,
    activeNote,
    activeNoteId,
    activeNotebookId,
    initializeWorkspace: store.initializeWorkspace,
    selectNote: store.selectNote,
    selectNotebook: store.selectNotebook,
    createNote: store.createNote,
    createNotebook: store.createNotebook,
    showNoteInFolder: store.showNoteInFolder,
    renameNote: store.renameNote,
    deleteNote: store.confirmDeleteNote,
    deleteNotebook: store.confirmDeleteNotebook,
    renameNotebook: store.renameNotebook,
    updateActiveContent: store.updateActiveContent,
    toggleNodeLock: store.toggleNodeLock,
    forceFlushAutoSave: store.forceFlushAutoSave,
    openHistoryDialog: store.openHistoryDialog,
  };
}
