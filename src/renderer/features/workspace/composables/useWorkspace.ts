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
    initializeWorkspace: () => store.initializeWorkspace(),
    selectNote: (id: string) => store.selectNote(id),
    createNote: () => store.createNote(),
    updateActiveContent: (content: string) => store.updateActiveContent(content),
    deleteNote: (id: string) => store.deleteNote(id),
  };
}
