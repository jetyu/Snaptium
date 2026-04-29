import { defineStore } from 'pinia';
import { ref } from 'vue';
import { createLogger } from '@renderer/features/logger';
import { getErrorMessage } from '@shared/utils/error.utils';
import { trashService, type TrashNode } from '../services/trash.service';

const trashLogger = createLogger('TrashStore');

export const useTrashStore = defineStore('trash', () => {
  const isOpen = ref(false);
  const trashedNodes = ref<TrashNode[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const clearError = () => {
    error.value = null;
  };

  const refreshTrash = async () => {
    isLoading.value = true;
    clearError();

    try {
      trashedNodes.value = await trashService.getTrashedNodes();
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      error.value = message;
      trashedNodes.value = [];
      trashLogger.error(`Failed to fetch trashed nodes: ${message}`);
    } finally {
      isLoading.value = false;
    }
  };

  const openTrash = async () => {
    isOpen.value = true;
    await refreshTrash();
  };

  const closeTrash = () => {
    isOpen.value = false;
    clearError();
  };

  const restoreNode = async (nodeId: string): Promise<boolean> => {
    clearError();
    try {
      await trashService.restoreNode(nodeId);
      await refreshTrash();
      return true;
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      error.value = message;
      trashLogger.error(`Failed to restore node ${nodeId}: ${message}`);
      return false;
    }
  };

  const permanentlyDeleteNode = async (nodeId: string): Promise<boolean> => {
    clearError();
    try {
      const deleted = await trashService.permanentlyDeleteNode(nodeId);
      if (!deleted) {
        return false;
      }

      await refreshTrash();
      return true;
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      error.value = message;
      trashLogger.error(`Failed to permanently delete node ${nodeId}: ${message}`);
      return false;
    }
  };

  const emptyTrash = async (): Promise<boolean> => {
    clearError();
    try {
      const emptied = await trashService.emptyTrash();
      if (!emptied) {
        return false;
      }

      trashedNodes.value = [];
      await refreshTrash();
      return true;
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      error.value = message;
      trashLogger.error(`Failed to empty trash: ${message}`);
      return false;
    }
  };

  return {
    isOpen,
    trashedNodes,
    isLoading,
    error,
    clearError,
    openTrash,
    closeTrash,
    refreshTrash,
    restoreNode,
    permanentlyDeleteNode,
    emptyTrash,
  };
});
