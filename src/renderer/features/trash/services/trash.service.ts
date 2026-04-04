import { electronApi } from '@renderer/core/bridge/electronApi';

/**
 * Service to handle Trash related business logic.
 * Encapsulates VFS calls and triggers system-wide refresh events.
 */
export const trashService = {
  /**
   * Fetch all nodes currently in the trash.
   */
  async getTrashedNodes() {
    return await electronApi.vfs.getTrashedNodes();
  },

  /**
   * Restore a node from the trash recursively.
   * Dispatches 'vfs-changed' to notify the system (e.g., Sidebar) to refresh.
   */
  async restoreNode(nodeId: string) {
    const result = await electronApi.vfs.restoreNode(nodeId);
    notifyVfsChanged();
    return result;
  },

  /**
   * Permanently delete a node and its descendants.
   */
  async permanentlyDeleteNode(nodeId: string) {
    const result = await electronApi.vfs.permanentlyDeleteNode(nodeId);
    notifyVfsChanged();
    return result;
  },

  /**
   * Empty the entire trash.
   */
  async emptyTrash() {
    const result = await electronApi.vfs.emptyTrash();
    notifyVfsChanged();
    return result;
  },
};

/**
 * Notify the renderer process that the file system has changed.
 * This triggers refreshes in the Sidebar and other interested components.
 */
function notifyVfsChanged() {
  window.dispatchEvent(new CustomEvent('vfs-changed'));
}
