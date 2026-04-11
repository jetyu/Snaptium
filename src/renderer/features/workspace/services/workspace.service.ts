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

interface SaveNoteContentResult {
    success: boolean;
    content: string;
}

interface ToggleNodeLockResult {
    locked: boolean;
    updatedAt: number;
}

function isVfsAvailable(): boolean {
    return electronApi.vfs.isAvailable();
}

function ensureVfsAvailable() {
    if (!isVfsAvailable()) {
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

function normalizeContentId(contentId: string): string {
    const normalized = contentId.trim();
    if (!normalized) {
        throw new Error('Content ID cannot be empty');
    }
    return normalized;
}

function normalizeFilename(filename: string): string {
    const normalized = filename.trim();
    if (!normalized) {
        throw new Error('Filename cannot be empty');
    }
    return normalized;
}

function normalizeNoteTitle(title?: string | null): string {
    const normalized = title?.trim();
    return normalized || i18n.global.t('common.untitledNote');
}

function normalizeNotebookName(name?: string | null): string {
    const normalized = name?.trim();
    return normalized || i18n.global.t('common.untitledNotebook');
}

function normalizeDialogName(name?: string | null): string {
    const normalized = name?.trim();
    return normalized || i18n.global.t('default.thisItem');
}

function normalizeMultilineContent(content: string): string {
    return content.replace(/\r\n/g, '\n');
}

function notifyVfsChanged() {
    window.dispatchEvent(new CustomEvent('vfs-changed'));
}

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
        title: normalizeNoteTitle(node.name),
        content: normalizeMultilineContent(content),
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
        name: normalizeNotebookName(node.name),
        parentId: node.parentId ?? null,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
        locked: node.locked ?? false,
    };
}

export const workspaceService = {
    isAvailable(): boolean {
        return isVfsAvailable();
    },

    async initWorkspace(): Promise<WorkspaceData> {
        if (!isVfsAvailable()) {
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
        ensureVfsAvailable();

        const noteTitle = normalizeNoteTitle(title);
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
            title: normalizeNoteTitle(node.name),
            content,
            parentId: node.parentId ?? null,
            createdAt: node.createdAt,
            updatedAt: node.updatedAt,
            locked: node.locked ?? false,
        };
    },

    async createNotebook(parentId: string | null, name?: string): Promise<Notebook> {
        ensureVfsAvailable();

        const notebookName = normalizeNotebookName(name);

        const node = await electronApi.vfs.createFolder({
            parentId,
            name: notebookName,
        });

        notifyVfsChanged();

        return {
            id: node.id,
            name: normalizeNotebookName(node.name),
            parentId: node.parentId ?? null,
            createdAt: node.createdAt,
            updatedAt: node.updatedAt,
            locked: node.locked ?? false,
        };
    },

    async renameNote(note: Note, newTitle: string): Promise<{ title: string; content: string; updatedAt: number }> {
        ensureVfsAvailable();

        const trimmedTitle = normalizeNoteTitle(newTitle);
        const renamedNode = await electronApi.vfs.renameNode({
            nodeId: normalizeNodeId(note.id),
            name: trimmedTitle,
        });

        notifyVfsChanged();

        return {
            title: normalizeNoteTitle(renamedNode.name),
            content: normalizeMultilineContent(note.content),
            updatedAt: renamedNode.updatedAt,
        };
    },

    async renameNotebook(notebookId: string, newName: string): Promise<{ name: string; updatedAt: number }> {
        ensureVfsAvailable();

        const trimmedName = normalizeNotebookName(newName);
        const renamedNode = await electronApi.vfs.renameNode({
            nodeId: normalizeNodeId(notebookId),
            name: trimmedName,
        });

        notifyVfsChanged();

        return {
            name: normalizeNotebookName(renamedNode.name),
            updatedAt: renamedNode.updatedAt,
        };
    },

    async saveNoteContent(noteId: string, contentId: string, content: string): Promise<SaveNoteContentResult> {
        ensureVfsAvailable();

        const normalizedNoteId = normalizeNodeId(noteId);
        const normalizedContent = normalizeMultilineContent(content);
        const success = await electronApi.vfs.writeContent({
            contentId: normalizeContentId(contentId),
            content: normalizedContent,
        });

        if (success) {
            notifyNoteUpdated(normalizedNoteId);
        }

        return {
            success,
            content: normalizedContent,
        };
    },

    async showNoteInFolder(nodeId: string): Promise<void> {
        ensureVfsAvailable();

        const revealed = await electronApi.vfs.showNoteInFolder(normalizeNodeId(nodeId));
        if (!revealed) {
            throw new Error('Failed to reveal note in folder');
        }
    },

    async deleteNode(nodeId: string): Promise<void> {
        ensureVfsAvailable();

        await electronApi.vfs.deleteNode(normalizeNodeId(nodeId));
        notifyVfsChanged();
    },

    async confirmDeleteNode(name: string): Promise<boolean> {
        if (!isVfsAvailable()) {
            return false;
        }

        return await electronApi.vfs.confirmDeleteNode(normalizeDialogName(name));
    },

    async toggleNodeLock(nodeId: string, locked: boolean): Promise<ToggleNodeLockResult> {
        ensureVfsAvailable();

        const updatedNode = await electronApi.vfs.toggleNodeLock({
            nodeId: normalizeNodeId(nodeId),
            locked,
        });
        notifyVfsChanged();

        return {
            locked: updatedNode.locked ?? locked,
            updatedAt: updatedNode.updatedAt,
        };
    },

    async getHistory(contentId: string): Promise<HistoryVersion[]> {
        if (!isVfsAvailable()) {
            return [];
        }

        const historyVersions = await electronApi.vfs.getHistory(normalizeContentId(contentId));
        return [...historyVersions].sort((a, b) => b.timestamp - a.timestamp);
    },

    async getHistoryContent(contentId: string, filename: string): Promise<string> {
        ensureVfsAvailable();

        return await electronApi.vfs.getHistoryContent({
            contentId: normalizeContentId(contentId),
            filename: normalizeFilename(filename),
        });
    },

    async recoverVersion(nodeId: string, filename: string): Promise<boolean> {
        if (!isVfsAvailable()) {
            return false;
        }

        const normalizedNodeId = normalizeNodeId(nodeId);
        const success = await electronApi.vfs.recoverVersion({
            nodeId: normalizedNodeId,
            filename: normalizeFilename(filename),
        });

        if (success) {
            notifyVfsChanged();
            notifyNoteUpdated(normalizedNodeId);
        }

        return success;
    },

    async confirmRecoverVersion(): Promise<boolean> {
        if (!isVfsAvailable()) {
            return false;
        }

        return await electronApi.vfs.confirmRecoverVersion();
    },
};
