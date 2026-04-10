import { i18n } from '@renderer/features/i18n';
import { electronApi, type HistoryVersion } from '@renderer/core/bridge/electronApi';

export interface Note {
    id: string;
    contentId: string;
    title: string;
    content: string;
    parentId: string | null;
    createdAt: number;
    updatedAt: number;
    locked?: boolean;
}

export interface Notebook {
    id: string;
    name: string;
    parentId: string | null;
    createdAt: number;
    updatedAt: number;
    locked?: boolean;
}

interface WorkspaceNode {
    id: string;
    type: string;
    name: string;
    parentId?: string | null;
    contentId?: string;
    createdAt: number;
    updatedAt: number;
    trashed?: boolean;
    locked?: boolean;
}

interface WorkspaceData {
    notes: Note[];
    notebooks: Notebook[];
}

function isAvailable(): boolean {
    return electronApi.vfs.isAvailable();
}

/**
 * Dispatch a global event to notify that the VFS structure (files/folders) has changed.
 */
function notifyVfsChanged() {
    window.dispatchEvent(new CustomEvent('vfs-changed'));
}

/**
 * Dispatch a granular event to notify that a specific note's content has been updated.
 */
function notifyNoteUpdated(noteId: string) {
    window.dispatchEvent(new CustomEvent('note-updated', { detail: { noteId } }));
}


function mapNodeToNote(node: WorkspaceNode, content: string): Note | null {
    if (node.type !== 'file' || !node.contentId || node.trashed) {
        return null;
    }

    return {
        id: node.id,
        contentId: node.contentId,
        title: node.name?.trim(),
        content,
        parentId: node.parentId ?? null,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
        locked: node.locked ?? false,
    };
}


function mapNodeToNotebook(node: WorkspaceNode): Notebook | null {
    if (node.type !== 'folder' || node.trashed) {
        return null;
    }

    return {
        id: node.id,
        name: node.name?.trim() || i18n.global.t('common.untitledNotebook'),
        parentId: node.parentId ?? null,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
        locked: node.locked ?? false,
    };
}

export const workspaceService = {

    isAvailable,


    async initWorkspace(): Promise<WorkspaceData> {
        if (!isAvailable()) {
            return { notes: [], notebooks: [] };
        }

        const { nodes } = await electronApi.vfs.initWorkspace();
        const workspaceNodes = nodes as WorkspaceNode[];

        const fileNodes = workspaceNodes.filter(
            (node) => node.type === 'file' && node.contentId && !node.trashed
        );
        const folderNodes = workspaceNodes.filter(
            (node) => node.type === 'folder' && !node.trashed
        );

        const notes = (
            await Promise.all(
                fileNodes.map(async (node) => {
                    const content = await electronApi.vfs.readContent(node.contentId as string);
                    return mapNodeToNote(node, content);
                })
            )
        ).filter((note): note is Note => note !== null);

        const notebooks = folderNodes
            .map((node) => mapNodeToNotebook(node))
            .filter((notebook): notebook is Notebook => notebook !== null);

        return { notes, notebooks };
    },


    async createNote(parentId: string | null, title?: string): Promise<Note> {
        if (!isAvailable()) {
            throw new Error('VFS not available');
        }

        const noteTitle = title?.trim() || i18n.global.t('common.untitledNote');
        const content = `# ${noteTitle}\n\n`;

        const node = await electronApi.vfs.createFile({
            parentId,
            name: noteTitle,
            content,
        });

        notifyVfsChanged();

        return {
            id: node.id,
            contentId: node.contentId!,
            title: node.name,
            content,
            parentId: node.parentId ?? null,
            createdAt: node.createdAt,
            updatedAt: node.updatedAt,
            locked: node.locked ?? false,
        };
    },


    async createNotebook(parentId: string | null, name?: string): Promise<Notebook> {
        if (!isAvailable()) {
            throw new Error('VFS not available');
        }

        const notebookName = name?.trim() || i18n.global.t('common.untitledNotebook');

        const node = await electronApi.vfs.createFolder({
            parentId,
            name: notebookName,
        });

        notifyVfsChanged();

        return {
            id: node.id,
            name: node.name,
            parentId: node.parentId ?? null,
            createdAt: node.createdAt,
            updatedAt: node.updatedAt,
            locked: node.locked ?? false,
        };
    },


    async renameNote(note: Note, newTitle: string): Promise<{ title: string; content: string; updatedAt: number }> {
        if (!isAvailable()) {
            throw new Error('VFS not available');
        }

        const trimmedTitle = newTitle.trim();
        if (!trimmedTitle) {
            throw new Error('Title cannot be empty');
        }

        const renamedNode = await electronApi.vfs.renameNode({
            nodeId: note.id,
            name: trimmedTitle,
        });

        notifyVfsChanged();

        return {
            title: renamedNode.name,
            content: note.content,
            updatedAt: renamedNode.updatedAt,
        };
    },

    async renameNotebook(notebookId: string, newName: string): Promise<{ name: string; updatedAt: number }> {
        if (!isAvailable()) {
            throw new Error('VFS not available');
        }

        const trimmedName = newName.trim();
        if (!trimmedName) {
            throw new Error('Name cannot be empty');
        }

        const renamedNode = await electronApi.vfs.renameNode({
            nodeId: notebookId,
            name: trimmedName,
        });

        notifyVfsChanged();

        return {
            name: renamedNode.name,
            updatedAt: renamedNode.updatedAt,
        };
    },


    async writeContent(contentId: string, content: string, noteId?: string | null): Promise<boolean> {
        if (!isAvailable()) {
            return false;
        }

        const success = await electronApi.vfs.writeContent({ contentId, content });
        if (success && noteId) {
            notifyNoteUpdated(noteId);
        }
        return success;
    },


    async readContent(contentId: string): Promise<string> {
        if (!isAvailable()) {
            throw new Error('VFS not available');
        }

        return await electronApi.vfs.readContent(contentId);
    },


    async deleteNode(nodeId: string): Promise<void> {
        if (!isAvailable()) {
            throw new Error('VFS not available');
        }

        await electronApi.vfs.deleteNode(nodeId);
        notifyVfsChanged();
    },


    async showNoteInFolder(nodeId: string): Promise<void> {
        if (!isAvailable()) {
            throw new Error('VFS not available');
        }

        await electronApi.vfs.showNoteInFolder(nodeId);
    },


    async toggleNodeLock(nodeId: string, locked: boolean): Promise<void> {
        if (!isAvailable()) {
            throw new Error('VFS not available');
        }

        await electronApi.vfs.toggleNodeLock({ nodeId, locked });
        notifyVfsChanged(); // Lock status is structural enough for refreshes
    },

    async getHistory(contentId: string): Promise<HistoryVersion[]> {
        if (!isAvailable()) {
            return [];
        }
        return await electronApi.vfs.getHistory(contentId);
    },

    async getHistoryContent(contentId: string, filename: string): Promise<string> {
        if (!isAvailable()) {
            throw new Error('VFS not available');
        }
        return await electronApi.vfs.getHistoryContent({ contentId, filename });
    },

    async recoverVersion(nodeId: string, filename: string): Promise<boolean> {
        if (!isAvailable()) {
            return false;
        }
        const success = await electronApi.vfs.recoverVersion({ nodeId, filename });
        if (success) {
            notifyVfsChanged();
            notifyNoteUpdated(nodeId);
        }
        return success;
    },
};
