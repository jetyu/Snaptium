import { defineStore } from 'pinia';
import { logger } from '@renderer/features/logger';
import { i18n } from '@renderer/features/i18n';

export interface Note {
  id: string;
  contentId: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface Notebook {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: number;
  updatedAt: number;
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
}

function generateUUID(): string {
  return crypto.randomUUID();
}

function createDefaultNotes(): Note[] {
  const now = Date.now();
  return [
    {
      id: generateUUID(),
      contentId: generateUUID(),
      title: i18n.global.t('welcome'),
      content: i18n.global.t('welcomeContent'),
      createdAt: now - 60000,
      updatedAt: now - 60000,
    },
  ];
}

function createFallbackNotes(): Note[] {
  return createDefaultNotes();
}

function mapNodeToNote(node: WorkspaceNode, content: string): Note | null {
  if (node.type !== 'file' || !node.contentId || node.trashed) {
    return null;
  }

  const title = node.name?.trim() || i18n.global.t('newNote');

  return {
    id: node.id,
    contentId: node.contentId,
    title,
    content,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
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
  };
}

export const useWorkspaceStore = defineStore('workspace', {
  state: () => {
    const notes = createDefaultNotes();
    return {
      notes,
      notebooks: [] as Notebook[],
      activeNoteId: notes[0].id as string | null,
      initialized: false,
    };
  },

  getters: {
    activeNote: (state): Note | null => {
      if (!state.activeNoteId) return null;
      return state.notes.find((n) => n.id === state.activeNoteId) ?? null;
    },

    sortedNotes: (state): Note[] =>
      [...state.notes].sort((a, b) => b.createdAt - a.createdAt || b.updatedAt - a.updatedAt),

    sortedNotebooks: (state): Notebook[] =>
      [...state.notebooks].sort((a, b) => a.createdAt - b.createdAt || a.name.localeCompare(b.name)),
  },

  actions: {
    async initializeWorkspace() {
      if (this.initialized) {
        return;
      }

      if (!window.electronAPI?.vfs) {
        logger.warn('electronAPI.vfs not available, falling back to in-memory notes.');
        this.notes = createFallbackNotes();
        this.notebooks = [];
        this.activeNoteId = this.notes[0]?.id ?? null;
        this.initialized = true;
        return;
      }

      try {
        const { nodes } = await window.electronAPI.vfs.initWorkspace();
        const workspaceNodes = nodes as WorkspaceNode[];
        const fileNodes = workspaceNodes.filter((node) => node.type === 'file' && node.contentId && !node.trashed);
        const folderNodes = workspaceNodes.filter((node) => node.type === 'folder' && !node.trashed);

        const loadedNotes = (await Promise.all(
          fileNodes.map(async (node) => {
            const content = await window.electronAPI.vfs!.readContent(node.contentId as string);
            return mapNodeToNote(node, content);
          }),
        )).filter((note): note is Note => note !== null);

        this.notes = loadedNotes.length > 0 ? loadedNotes : createFallbackNotes();
        this.notebooks = folderNodes
          .map((node) => mapNodeToNotebook(node))
          .filter((notebook): notebook is Notebook => notebook !== null);
        this.activeNoteId = this.notes[0]?.id ?? null;
        logger.info(`Workspace initialized with ${this.notes.length} note(s) and ${this.notebooks.length} notebook(s).`);
      } catch (err: unknown) {
        logger.error(`Failed to initialize workspace: ${err instanceof Error ? err.message : String(err)}`);
        this.notes = createFallbackNotes();
        this.notebooks = [];
        this.activeNoteId = this.notes[0]?.id ?? null;
      } finally {
        this.initialized = true;
      }
    },

    selectNote(id: string) {
      if (this.notes.some((n) => n.id === id)) {
        this.activeNoteId = id;
        logger.info(`Selected note: ${id}`);
      }
    },

    async createNote() {
      try {
        if (!window.electronAPI?.vfs) {
          logger.warn('electronAPI.vfs not available, cannot physically save note.');
          return;
        }

        const title = i18n.global.t('newNote');
        const content = `# ${title}\n\n`;
        const node = await window.electronAPI.vfs.createFile({
          parentId: null,
          name: title,
          content,
        });

        const newNote: Note = {
          id: node.id,
          contentId: node.contentId,
          title: node.name,
          content,
          createdAt: node.createdAt,
          updatedAt: node.updatedAt,
        };

        this.notes.unshift(newNote);
        this.activeNoteId = newNote.id;
        logger.info(`Created new note: ${node.id} with contentId ${node.contentId}`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`Failed to invoke VFS createFile: ${message}`);
        alert(`Failed to save! Error: ${message}`);
      }
    },

    async createNotebook() {
      try {
        if (!window.electronAPI?.vfs) {
          logger.warn('electronAPI.vfs not available, cannot physically save notebook.');
          return;
        }

        const name = i18n.global.t('default.newNotebook');
        const node = await window.electronAPI.vfs.createFolder({
          parentId: null,
          name,
        });

        this.notebooks.push({
          id: node.id,
          name: node.name,
          parentId: node.parentId ?? null,
          createdAt: node.createdAt,
          updatedAt: node.updatedAt,
        });
        logger.info(`Created new notebook: ${node.id}`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`Failed to invoke VFS createFolder: ${message}`);
        alert(`Failed to save! Error: ${message}`);
      }
    },

    async updateActiveContent(content: string) {
      const note = this.notes.find((n) => n.id === this.activeNoteId);
      if (!note) return;
      note.content = content;
      note.updatedAt = Date.now();
      const match = content.match(/^#\s+(.+)$/m);
      if (match) {
        note.title = match[1].trim();
      }

      if (window.electronAPI?.vfs) {
        const saved = await window.electronAPI.vfs.writeContent({
          contentId: note.contentId,
          content,
        });

        if (!saved) {
          logger.warn(`Failed to persist content for note: ${this.activeNoteId}`);
        }
      }

      logger.debug(`Updated content for note: ${this.activeNoteId}`);
    },

    deleteNote(id: string) {
      const idx = this.notes.findIndex((n) => n.id === id);
      if (idx === -1) return;
      this.notes.splice(idx, 1);
      if (this.activeNoteId === id) {
        this.activeNoteId = this.notes[0]?.id ?? null;
      }
      logger.info(`Deleted note: ${id}`);
    },
  },
});
