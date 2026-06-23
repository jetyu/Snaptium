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
    requestRenameActiveNode,
    deleteActiveNote,
    saveActiveNote,
  };
}
