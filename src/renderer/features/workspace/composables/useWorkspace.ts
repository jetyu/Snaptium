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
  const allTags = computed(() => store.allTags);

  return {
    notes,
    notebooks,
    sortedNotes,
    activeNote,
    activeNoteId,
    activeNotebookId,
    allTags,
    initializeWorkspace: store.initializeWorkspace,
    selectNote: store.selectNote,
    selectNotebook: store.selectNotebook,
    createNote: store.createNote,
    createNotebook: store.createNotebook,
    moveNode: store.moveNode,
    showNoteInFolder: store.showNoteInFolder,
    renameNote: store.renameNote,
    deleteNote: store.confirmDeleteNote,
    deleteNotebook: store.confirmDeleteNotebook,
    renameNotebook: store.renameNotebook,
    updateNoteTags: store.updateNoteTags,
    updateActiveNoteTags: store.updateActiveNoteTags,
    addTagToActiveNote: store.addTagToActiveNote,
    removeTagFromActiveNote: store.removeTagFromActiveNote,
    updateActiveContent: store.updateActiveContent,
    toggleNodeLock: store.toggleNodeLock,
    updateNotebookIconColor: store.updateNotebookIconColor,
    toggleNodeStar: store.toggleNodeStar,
    forceFlushAutoSave: store.forceFlushAutoSave,
    openHistoryDialog: store.openHistoryDialog,
    openNotePropertiesDialog: store.openNotePropertiesDialog,
  };
}
