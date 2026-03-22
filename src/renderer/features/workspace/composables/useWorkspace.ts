import { computed } from 'vue';
import { useWorkspaceStore } from '../store/workspace.store';

export function useWorkspace() {
  const store = useWorkspaceStore();

  const notes = computed(() => store.notes);
  const notebooks = computed(() => store.notebooks);
  const sortedNotes = computed(() => store.sortedNotes);
  const activeNote = computed(() => store.activeNote);
  const activeNoteId = computed(() => store.activeNoteId);

  return {
    notes,
    notebooks,
    sortedNotes,
    activeNote,
    activeNoteId,
    initializeWorkspace: store.initializeWorkspace,
    selectNote: store.selectNote,
    createNote: store.createNote,
    createNotebook: store.createNotebook,
    updateActiveContent: store.updateActiveContent,
    deleteNote: store.deleteNote,
  };
}
