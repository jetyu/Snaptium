import { ref } from 'vue';
import { trashService } from '../services/trash.service';

const isOpen = ref(false);
const trashedNodes = ref<any[]>([]);
const isLoading = ref(false);

export function useTrash() {
  const openTrash = async () => {
    isOpen.value = true;
    await refreshTrash();
  };

  const closeTrash = () => {
    isOpen.value = false;
  };

  const refreshTrash = async () => {
    isLoading.value = true;
    try {
      trashedNodes.value = await trashService.getTrashedNodes();
    } catch (error) {
      console.error('Failed to fetch trashed nodes:', error);
    } finally {
      isLoading.value = false;
    }
  };

  const restoreNode = async (nodeId: string) => {
    try {
      await trashService.restoreNode(nodeId);
      await refreshTrash();
    } catch (error) {
      console.error('Failed to restore node:', error);
    }
  };

  const permanentlyDeleteNode = async (nodeId: string) => {
    try {
      await trashService.permanentlyDeleteNode(nodeId);
      await refreshTrash();
    } catch (error) {
      console.error('Failed to delete node permanently:', error);
    }
  };

  const emptyTrash = async () => {
    try {
      await trashService.emptyTrash();
      await refreshTrash();
    } catch (error) {
      console.error('Failed to empty trash:', error);
    }
  };

  return {
    isOpen,
    trashedNodes,
    isLoading,
    openTrash,
    closeTrash,
    refreshTrash,
    restoreNode,
    permanentlyDeleteNode,
    emptyTrash,
  };
}
