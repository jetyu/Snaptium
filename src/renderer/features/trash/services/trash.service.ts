import { i18n } from '@renderer/features/i18n';
import { electronApi, type WorkspaceNodePayload } from '@renderer/core/bridge/electronApi';

export interface TrashNode extends WorkspaceNodePayload {
  childCount: number;
}

function isAvailable(): boolean {
  return electronApi.vfs.isAvailable();
}

function ensureAvailable() {
  if (!isAvailable()) {
    throw new Error('VFS not available');
  }
}

function normalizeNodeId(nodeId: string): string {
  const normalized = nodeId.trim();
  if (!normalized) {
    throw new Error('Node ID cannot be empty');
  }
  return normalized;
}

function notifyVfsChanged() {
  window.dispatchEvent(new CustomEvent('vfs-changed'));
}

function normalizeNodeName(node: WorkspaceNodePayload): string {
  const normalized = node.name?.trim();
  if (normalized) {
    return normalized;
  }

  return node.type === 'folder'
    ? i18n.global.t('common.untitledNotebook')
    : i18n.global.t('common.untitledNote');
}

function normalizeTrashNode(node: WorkspaceNodePayload & { childCount?: number }): TrashNode {
  return {
    ...node,
    name: normalizeNodeName(node),
    childCount: Math.max(0, Number(node.childCount ?? 0)),
    locked: node.locked ?? false,
    trashed: true,
  };
}

function sortTrashNodes(nodes: TrashNode[]): TrashNode[] {
  return [...nodes].sort((left, right) => {
    if (left.type !== right.type) {
      return left.type === 'folder' ? -1 : 1;
    }

    if (left.updatedAt !== right.updatedAt) {
      return right.updatedAt - left.updatedAt;
    }

    return left.name.localeCompare(right.name);
  });
}

export const trashService = {
  isAvailable,

  async getTrashedNodes(): Promise<TrashNode[]> {
    if (!isAvailable()) {
      return [];
    }

    const nodes = await electronApi.vfs.getTrashedNodes();
    return sortTrashNodes(nodes.map((node) => normalizeTrashNode(node as WorkspaceNodePayload & { childCount?: number })));
  },

  async restoreNode(nodeId: string): Promise<void> {
    ensureAvailable();

    await electronApi.vfs.restoreNode(normalizeNodeId(nodeId));
    notifyVfsChanged();
  },

  async permanentlyDeleteNode(nodeId: string): Promise<boolean> {
    ensureAvailable();

    const confirmed = await electronApi.vfs.confirmPermanentDeleteNode();
    if (!confirmed) {
      return false;
    }

    const success = await electronApi.vfs.permanentlyDeleteNode(normalizeNodeId(nodeId));
    if (!success) {
      throw new Error('Failed to permanently delete trash node');
    }

    notifyVfsChanged();
    return true;
  },

  async emptyTrash(): Promise<boolean> {
    ensureAvailable();

    const confirmed = await electronApi.vfs.confirmEmptyTrash();
    if (!confirmed) {
      return false;
    }

    const success = await electronApi.vfs.emptyTrash();
    if (!success) {
      throw new Error('Failed to empty trash');
    }

    notifyVfsChanged();
    return true;
  },
};