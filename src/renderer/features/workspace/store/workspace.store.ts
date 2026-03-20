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

interface WorkspaceNode {
  id: string;
  type: string;
  name: string;
  contentId?: string;
  createdAt: number;
  updatedAt: number;
  trashed?: boolean;
}

// Generate UUID
function generateUUID(): string {
  return crypto.randomUUID();
}

// Default notes for initial state
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

function createEmptyWorkspaceState() {
  return {
    notes: [] as Note[],
    activeNoteId: null as string | null,
  };
}

export const useWorkspaceStore = defineStore('workspace', {
  state: () => {
    const { notes, activeNoteId } = createEmptyWorkspaceState();
    return {
      notes,
      activeNoteId,
      initialized: false,
    };
  },

  getters: {
    // 当前激活的笔记
    activeNote: (state): Note | null => {
      if (!state.activeNoteId) return null;
      return state.notes.find((n) => n.id === state.activeNoteId) ?? null;
    },

    // 按创建时间降序排序的笔记列表
    sortedNotes: (state): Note[] =>
      [...state.notes].sort((a, b) => b.createdAt - a.createdAt || b.updatedAt - a.updatedAt),
  },

  actions: {
    async initializeWorkspace() {
      if (this.initialized) {
        return;
      }

      if (!window.electronAPI?.vfs) {
        logger.warn('electronAPI.vfs not available, falling back to in-memory notes.');
        this.notes = createFallbackNotes();
        this.activeNoteId = this.notes[0]?.id ?? null;
        this.initialized = true;
        return;
      }

      try {
        const { nodes } = await window.electronAPI.vfs.initWorkspace();
        const fileNodes = (nodes as WorkspaceNode[])
          .filter((node) => node.type === 'file' && node.contentId && !node.trashed);

        const loadedNotes = (await Promise.all(
          fileNodes.map(async (node) => {
            const content = await window.electronAPI.vfs!.readContent(node.contentId as string);
            return mapNodeToNote(node, content);
          }),
        )).filter((note): note is Note => note !== null);

        this.notes = loadedNotes;
        this.activeNoteId = this.notes[0]?.id ?? null;
        logger.info(`Workspace initialized with ${this.notes.length} note(s).`);
      } catch (err: unknown) {
        logger.error(`Failed to initialize workspace: ${err instanceof Error ? err.message : String(err)}`);
        this.notes = createFallbackNotes();
        this.activeNoteId = this.notes[0]?.id ?? null;
      } finally {
        this.initialized = true;
      }
    },

    // 选中指定笔记
    selectNote(id: string) {
      if (this.notes.some((n) => n.id === id)) {
        this.activeNoteId = id;
        logger.info(`Selected note: ${id}`);
      }
    },

    // 新建笔记并自动选中
    async createNote() {
      try {
        if (!window.electronAPI?.vfs) {
          logger.warn('electronAPI.vfs not available, cannot physically save note.');
          return;
        }

        if (!this.initialized) {
          await this.initializeWorkspace();
        }

        const title = i18n.global.t('newNote');
        const content = `# ${title}\n\n`;

        // Wait for main process VFS to create actual file & register in nodes.jsonl
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

        this.notes = [newNote, ...this.notes.filter((note) => note.id !== newNote.id)];
        this.activeNoteId = newNote.id;
        logger.info(`Created new note: ${node.id} with contentId ${node.contentId}`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`Failed to invoke VFS createFile: ${message}`);
        alert(`Failed to save! Error: ${message}`);
      }
    },

    // 更新当前激活笔记的内容
    async updateActiveContent(content: string) {
      const note = this.notes.find((n) => n.id === this.activeNoteId);
      if (!note) return;
      note.content = content;
      note.updatedAt = Date.now();
      // Auto-generate title from first h1 heading
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

    // 删除指定笔记
    deleteNote(id: string) {
      const idx = this.notes.findIndex((n) => n.id === id);
      if (idx === -1) return;
      this.notes.splice(idx, 1);
      // Select next available note
      if (this.activeNoteId === id) {
        this.activeNoteId = this.notes[0]?.id ?? null;
      }
      logger.info(`Deleted note: ${id}`);
    },
  },
});
