import { storeToRefs } from 'pinia';
import { useTrashStore } from '../store/trash.store';

export function useTrash() {
  const trashStore = useTrashStore();
  const { isOpen, trashedNodes, isLoading, error } = storeToRefs(trashStore);

  return {
    isOpen,
    trashedNodes,
    isLoading,
    error,
    clearError: trashStore.clearError,
    openTrash: trashStore.openTrash,
    closeTrash: trashStore.closeTrash,
    refreshTrash: trashStore.refreshTrash,
    restoreNode: trashStore.restoreNode,
    permanentlyDeleteNode: trashStore.permanentlyDeleteNode,
    emptyTrash: trashStore.emptyTrash,
  };
}
