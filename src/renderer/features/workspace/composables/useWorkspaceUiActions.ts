import { readonly, ref } from 'vue';
import { useWorkspaceStore } from '../store/workspace.store';
import { createLogger } from '@renderer/features/logger';
import { getErrorMessage } from '@shared/utils/error.utils';

interface WorkspaceRenameRequest {
  id: number;
}

const workspaceUiActionsLogger = createLogger('WorkspaceUiActions');
const workspaceRenameRequest = ref<WorkspaceRenameRequest>({
  id: 0,
});

export function useWorkspaceUiActions() {
  const workspaceStore = useWorkspaceStore();

  const requestRenameActiveNode = (): void => {
    workspaceRenameRequest.value = {
      id: workspaceRenameRequest.value.id + 1,
    };
  };

  const createNotebookFromActiveContext = async () => {
    const parentId = workspaceStore.activeNote?.parentId ?? workspaceStore.activeNotebookId ?? null;

    try {
      await workspaceStore.createNotebook(parentId);
      return true;
    } catch (error) {
      workspaceUiActionsLogger.error(`Failed to create notebook: ${getErrorMessage(error)}`);
      return false;
    }
  };

  const toggleActiveNoteReadMode = async () => {
    const activeNote = workspaceStore.activeNote;
    if (!activeNote) {
      workspaceUiActionsLogger.warn('No active note to toggle read mode');
      return false;
    }

    try {
      await workspaceStore.setNoteReadMode(activeNote.id, !Boolean(activeNote.locked));
      return true;
    } catch (error) {
      workspaceUiActionsLogger.error(`Failed to toggle read mode: ${getErrorMessage(error)}`);
      return false;
    }
  };

  const toggleActiveNodeStar = async () => {
    const activeNote = workspaceStore.activeNote;
    if (activeNote) {
      try {
        await workspaceStore.toggleNodeStar(activeNote.id, 'note', !Boolean(activeNote.starred));
        return true;
      } catch (error) {
        workspaceUiActionsLogger.error(`Failed to toggle note star: ${getErrorMessage(error)}`);
        return false;
      }
    }

    const activeNotebookId = workspaceStore.activeNotebookId;
    if (!activeNotebookId) {
      workspaceUiActionsLogger.warn('No active node to toggle star');
      return false;
    }

    const activeNotebook = workspaceStore.notebooks.find((notebook) => notebook.id === activeNotebookId);
    if (!activeNotebook) {
      workspaceUiActionsLogger.warn(`Cannot toggle notebook star, notebook not found: ${activeNotebookId}`);
      return false;
    }

    try {
      await workspaceStore.toggleNodeStar(activeNotebook.id, 'notebook', !Boolean(activeNotebook.starred));
      return true;
    } catch (error) {
      workspaceUiActionsLogger.error(`Failed to toggle notebook star: ${getErrorMessage(error)}`);
      return false;
    }
  };

  const openActiveNoteProperties = () => {
    const activeNote = workspaceStore.activeNote;
    if (!activeNote) {
      workspaceUiActionsLogger.warn('No active note to open properties');
      return false;
    }

    workspaceStore.openNotePropertiesDialog(activeNote.id);
    return true;
  };

  const openActiveNoteHistory = async () => {
    const activeNote = workspaceStore.activeNote;
    if (!activeNote) {
      workspaceUiActionsLogger.warn('No active note to open history');
      return false;
    }

    try {
      await workspaceStore.openHistoryDialog(activeNote.id);
      return true;
    } catch (error) {
      workspaceUiActionsLogger.error(`Failed to open note history: ${getErrorMessage(error)}`);
      return false;
    }
  };

  const deleteActiveNote = async () => {
    const activeNote = workspaceStore.activeNote;
    if (!activeNote) {
      workspaceUiActionsLogger.warn('No active note to delete');
      return false;
    }

    try {
      return await workspaceStore.confirmDeleteNote(activeNote.id);
    } catch (error) {
      workspaceUiActionsLogger.error(`Failed to delete note: ${getErrorMessage(error)}`);
      return false;
    }
  };

  const saveActiveNote = async () => {
    try {
      await workspaceStore.forceFlushAutoSave();
      return true;
    } catch (error) {
      workspaceUiActionsLogger.error(`Failed to save note: ${getErrorMessage(error)}`);
      return false;
    }
  };

  return {
    workspaceRenameRequest: readonly(workspaceRenameRequest),
    createNotebookFromActiveContext,
    requestRenameActiveNode,
    toggleActiveNoteReadMode,
    toggleActiveNodeStar,
    openActiveNoteProperties,
    openActiveNoteHistory,
    deleteActiveNote,
    saveActiveNote,
  };
}
