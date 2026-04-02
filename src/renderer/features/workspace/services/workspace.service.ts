import { i18n } from '@renderer/features/i18n';

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
    return !!window.electronAPI?.vfs;
}


function mapNodeToNote(node: WorkspaceNode, content: string): Note | null {
    if (node.type !== 'file' || !node.contentId || node.trashed) {
        return null;
    }

    return {
        id: node.id,
        contentId: node.contentId,
        title: node.name?.trim() || i18n.global.t('newNote'),
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
        name: node.name?.trim() || i18n.global.t('default.newNotebook'),
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

        const { nodes } = await window.electronAPI.vfs!.initWorkspace();
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
                    const content = await window.electronAPI.vfs!.readContent(node.contentId as string);
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

        const noteTitle = title?.trim() || i18n.global.t('newNote');
        const content = `# ${noteTitle}\n\n`;

        const node = await window.electronAPI.vfs!.createFile({
            parentId,
            name: noteTitle,
            content,
        });

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

        const notebookName = name?.trim() || i18n.global.t('default.newNotebook');

        const node = await window.electronAPI.vfs!.createFolder({
            parentId,
            name: notebookName,
        });

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

        const renamedNode = await window.electronAPI.vfs!.renameNode({
            nodeId: note.id,
            name: trimmedTitle,
        });

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

        const renamedNode = await window.electronAPI.vfs!.renameNode({
            nodeId: notebookId,
            name: trimmedName,
        });

        return {
            name: renamedNode.name,
            updatedAt: renamedNode.updatedAt,
        };
    },

    
    async writeContent(contentId: string, content: string): Promise<boolean> {
        if (!isAvailable()) {
            return false;
        }

        return await window.electronAPI.vfs!.writeContent({ contentId, content });
    },

    
    async readContent(contentId: string): Promise<string> {
        if (!isAvailable()) {
            throw new Error('VFS not available');
        }

        return await window.electronAPI.vfs!.readContent(contentId);
    },

    
    async deleteNode(nodeId: string): Promise<void> {
        if (!isAvailable()) {
            throw new Error('VFS not available');
        }

        await window.electronAPI.vfs!.deleteNode(nodeId);
    },

    
    async showNoteInFolder(nodeId: string): Promise<void> {
        if (!isAvailable()) {
            throw new Error('VFS not available');
        }

        await window.electronAPI.vfs!.showNoteInFolder(nodeId);
    },

   
    async toggleNodeLock(nodeId: string, locked: boolean): Promise<void> {
        if (!isAvailable()) {
            throw new Error('VFS not available');
        }

        await window.electronAPI.vfs!.toggleNodeLock({ nodeId, locked });
    },
};
