import { i18n } from '@renderer/features/i18n';
import { electronApi, type HistoryVersion, type SavedImagePayload } from '@renderer/core/bridge/electronApi';
import {
    isNotebookIconColor,
    normalizeNotebookIconEmoji,
    type NotebookIconColor,
    type NotebookIconEmoji,
} from '@shared/notebook-icon.constants';

export interface Note {
    id: string;
    contentId: string;
    title: string;
    content: string;
    parentId: string | null;
    order: number;
    createdAt: number;
    updatedAt: number;
    locked?: boolean;
    starred?: boolean;
    starredAt?: number;
    tags: string[];
}

export interface Notebook {
    id: string;
    name: string;
    parentId: string | null;
    order: number;
    createdAt: number;
    updatedAt: number;
    locked?: boolean;
    iconColor?: NotebookIconColor;
    iconEmoji?: NotebookIconEmoji;
    starred?: boolean;
    starredAt?: number;
}

interface WorkspaceNode {
    id: string;
    type: string;
    name: string;
    parentId?: string | null;
    order?: number;
    contentId?: string;
    createdAt: number;
    updatedAt: number;
    trashed?: boolean;
    locked?: boolean;
    iconColor?: NotebookIconColor;
    iconEmoji?: NotebookIconEmoji;
    starred?: boolean;
    starredAt?: number;
    tags?: string[];
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

export interface StarredNote {
    kind: 'note';
    id: string;
    title: string;
    parentId: string | null;
    createdAt: number;
    updatedAt: number;
    locked: boolean;
    starredAt: number;
}

export interface StarredNotebook {
    kind: 'notebook';
    id: string;
    name: string;
    parentId: string | null;
    createdAt: number;
    updatedAt: number;
    locked: boolean;
    iconColor?: NotebookIconColor;
    iconEmoji?: NotebookIconEmoji;
    starredAt: number;
}

export type StarredNode = StarredNote | StarredNotebook;

let currentWorkspaceRoot: string | null = null;

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

function normalizeNotebookIconColor(value: unknown): NotebookIconColor | undefined {
    return isNotebookIconColor(value) ? value : undefined;
}

function normalizeNotebookEmoji(value: unknown): NotebookIconEmoji | undefined {
    return normalizeNotebookIconEmoji(value);
}

function normalizeMultilineContent(content: string): string {
    return content.replace(/\r\n/g, '\n');
}

export const MAX_TAGS_PER_NOTE = 5;
const MAX_TAG_LENGTH = 48;

export function normalizeNoteTag(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }

    const normalized = value
        .trim()
        .replace(/^#+/, '')
        .replace(/\s+/g, ' ')
        .slice(0, MAX_TAG_LENGTH);

    return normalized.length > 0 ? normalized : null;
}

export function normalizeNoteTags(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    const tags: string[] = [];
    const seen = new Set<string>();

    for (const item of value) {
        const tag = normalizeNoteTag(item);
        if (!tag) {
            continue;
        }

        const key = tag.toLocaleLowerCase();
        if (seen.has(key)) {
            continue;
        }

        seen.add(key);
        tags.push(tag);
        if (tags.length >= MAX_TAGS_PER_NOTE) {
            break;
        }
    }

    return tags;
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
        order: Number(node.order ?? node.createdAt),
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
        locked: node.locked ?? false,
        starred: Boolean(node.starred),
        starredAt: node.starredAt as number | undefined,
        tags: normalizeNoteTags(node.tags),
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
        order: Number(node.order ?? node.createdAt),
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
        locked: node.locked ?? false,
        iconColor: normalizeNotebookIconColor(node.iconColor),
        iconEmoji: normalizeNotebookEmoji(node.iconEmoji),
        starred: Boolean(node.starred),
        starredAt: node.starredAt as number | undefined,
    };
}

function normalizeStarredAt(timestamp: unknown, fallback: number): number {
    const normalized = Number(timestamp);
    if (Number.isFinite(normalized) && normalized > 0) {
        return normalized;
    }

    return fallback;
}

function mapNodeToStarredNode(node: WorkspaceNode): StarredNode | null {
    const starredAt = normalizeStarredAt(node.starredAt, node.updatedAt);

    if (node.type === 'file') {
        return {
            kind: 'note',
            id: node.id,
            title: normalizeNoteTitle(node.name),
            parentId: node.parentId ?? null,
            createdAt: node.createdAt,
            updatedAt: node.updatedAt,
            locked: node.locked ?? false,
            starredAt,
        };
    }

    if (node.type === 'folder') {
        return {
            kind: 'notebook',
            id: node.id,
            name: normalizeNotebookName(node.name),
            parentId: node.parentId ?? null,
            createdAt: node.createdAt,
            updatedAt: node.updatedAt,
            locked: node.locked ?? false,
            iconColor: normalizeNotebookIconColor(node.iconColor),
            iconEmoji: normalizeNotebookEmoji(node.iconEmoji),
            starredAt,
        };
    }

    return null;
}

export const workspaceService = {
    isAvailable(): boolean {
        return isVfsAvailable();
    },

    async initWorkspace(): Promise<WorkspaceData> {
        if (!isVfsAvailable()) {
            currentWorkspaceRoot = null;
            return { notes: [], notebooks: [] };
        }

        currentWorkspaceRoot = null;
        const { root, nodes } = await electronApi.vfs.initWorkspace();
        currentWorkspaceRoot = root;
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

    getCurrentWorkspaceRoot(): string | null {
        return currentWorkspaceRoot;
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
            order: Number(node.order ?? node.createdAt),
            createdAt: node.createdAt,
            updatedAt: node.updatedAt,
            locked: node.locked ?? false,
            tags: normalizeNoteTags(node.tags),
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
            order: Number(node.order ?? node.createdAt),
            createdAt: node.createdAt,
            updatedAt: node.updatedAt,
            locked: node.locked ?? false,
            iconColor: normalizeNotebookIconColor(node.iconColor),
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

    async saveNoteImage(
        contentId: string,
        payload: { fileName?: string | null; mimeType: string; dataBase64: string }
    ): Promise<SavedImagePayload> {
        ensureVfsAvailable();

        return await electronApi.vfs.saveImage({
            contentId: normalizeContentId(contentId),
            fileName: payload.fileName?.trim() || undefined,
            mimeType: payload.mimeType,
            dataBase64: payload.dataBase64,
        });
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

    async moveNode(payload: { nodeId: string; parentId: string | null; index: number }): Promise<void> {
        ensureVfsAvailable();

        await electronApi.vfs.moveNode({
            nodeId: normalizeNodeId(payload.nodeId),
            parentId: payload.parentId ? normalizeNodeId(payload.parentId) : null,
            index: payload.index,
        });
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

    async updateNotebookIconColor(
        notebookId: string,
        iconColor: NotebookIconColor | null
    ): Promise<{ iconColor: NotebookIconColor | undefined; updatedAt: number }> {
        ensureVfsAvailable();

        const updatedNode = await electronApi.vfs.updateNotebookIconColor({
            nodeId: normalizeNodeId(notebookId),
            iconColor,
        });
        notifyVfsChanged();

        return {
            iconColor: normalizeNotebookIconColor(updatedNode.iconColor),
            updatedAt: updatedNode.updatedAt,
        };
    },

    async updateNotebookIconEmoji(
        notebookId: string,
        iconEmoji: NotebookIconEmoji | null
    ): Promise<{ iconEmoji: NotebookIconEmoji | undefined; updatedAt: number }> {
        ensureVfsAvailable();

        const updatedNode = await electronApi.vfs.updateNotebookIconEmoji({
            nodeId: normalizeNodeId(notebookId),
            iconEmoji,
        });
        notifyVfsChanged();

        return {
            iconEmoji: normalizeNotebookEmoji(updatedNode.iconEmoji),
            updatedAt: updatedNode.updatedAt,
        };
    },

    async updateNoteTags(nodeId: string, tags: string[]): Promise<{ tags: string[]; updatedAt: number }> {
        ensureVfsAvailable();

        const updatedNode = await electronApi.vfs.updateNodeTags({
            nodeId: normalizeNodeId(nodeId),
            tags: normalizeNoteTags(tags),
        });
        notifyVfsChanged();

        return {
            tags: normalizeNoteTags(updatedNode.tags),
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

    async toggleNodeStar(nodeId: string, starred: boolean): Promise<{ starred: boolean; starredAt: number | undefined }> {
        ensureVfsAvailable();

        const updatedNode = await electronApi.vfs.toggleNodeStar({
            nodeId: normalizeNodeId(nodeId),
            starred,
        });
        notifyVfsChanged();

        return {
            starred: Boolean(updatedNode.starred),
            starredAt: updatedNode.starredAt,
        };
    },

    async getStarredNodes(): Promise<StarredNode[]> {
        if (!isVfsAvailable()) {
            return [];
        }

        const nodes = await electronApi.vfs.getStarredNodes();
        return (nodes as WorkspaceNode[])
            .map((node) => mapNodeToStarredNode(node))
            .filter((node): node is StarredNode => node !== null)
            .sort((left, right) => {
                if (left.starredAt !== right.starredAt) {
                    return right.starredAt - left.starredAt;
                }
                return right.updatedAt - left.updatedAt;
            });
    },

    async confirmRecoverVersion(): Promise<boolean> {
        if (!isVfsAvailable()) {
            return false;
        }

        return await electronApi.vfs.confirmRecoverVersion();
    },
};
