import { computed } from 'vue';
import { useWorkspaceStore } from '../store/workspace.store';

export function useWorkspace() {
  const store = useWorkspaceStore();

  const notes = computed(() => store.notes);
  const sortedNotes = computed(() => store.sortedNotes);
  const activeNote = computed(() => store.activeNote);
  const activeNoteId = computed(() => store.activeNoteId);

  return {
    notes,
    sortedNotes,
    activeNote,
    activeNoteId,
    initializeWorkspace: store.initializeWorkspace,
    selectNote: store.selectNote,
    createNote: store.createNote,
    updateActiveContent: store.updateActiveContent,
    deleteNote: store.deleteNote,
  };
}
