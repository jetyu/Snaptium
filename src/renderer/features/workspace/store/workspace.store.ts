import { defineStore } from 'pinia';
import { createLogger } from '@renderer/features/logger';
import  { type HistoryVersion } from '@renderer/core/bridge/electronApi';
import { workspaceService, type Note, type Notebook } from '../services/workspace.service';
import { WORKSPACE_CONSTANTS, type SaveStatus } from '../constants/workspace.constants';

const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
const logger = createLogger('Workspace Store');
export const useWorkspaceStore = defineStore('workspace', {
  state: () => {
    return {
      notes: [] as Note[],
      notebooks: [] as Notebook[],
      activeNoteId: null as string | null,
      activeNotebookId: null as string | null,
      initialized: false,
      savingStatus: WORKSPACE_CONSTANTS.SAVE_STATUS.IDLE as SaveStatus,
      lastSaveTime: null as number | null,
      lastSavedNoteMeta: null as { noteId: string; title: string; contentId: string; savedAt: number } | null,
      saveError: null as string | null,
      isHistoryDialogOpen: false,
      historyVersions: [] as HistoryVersion[],
      historyLoading: false,
    };
  },

  getters: {
    activeNote: (state): Note | null => {
      if (!state.activeNoteId) return null;
      return state.notes.find((note) => note.id === state.activeNoteId) ?? null;
    },

    activeNotebook: (state): Notebook | null => {
      if (!state.activeNotebookId) return null;
      return state.notebooks.find((notebook) => notebook.id === state.activeNotebookId) ?? null;
    },

    sortedNotes: (state): Note[] =>
      [...state.notes].sort((a, b) => a.createdAt - b.createdAt || a.updatedAt - b.updatedAt),

    sortedNotebooks: (state): Notebook[] =>
      [...state.notebooks].sort((a, b) => a.createdAt - b.createdAt || a.name.localeCompare(b.name)),
  },

  actions: {
    async initializeWorkspace(force = false) {
      if (this.initialized && !force) {
        return;
      }

      if (!window.__vfsListenerAdded) {
        window.addEventListener('vfs-changed', () => {
          logger.info('VFS change detected, refreshing workspace...');
          this.initializeWorkspace(true);
        });
        window.__vfsListenerAdded = true;
      }

      if (!workspaceService.isAvailable()) {
        logger.warn('Workspace service not available, starting with empty workspace.');
        this.notes = [];
        this.notebooks = [];
        this.activeNoteId = null;
        this.activeNotebookId = null;
        this.initialized = true;
        return;
      }

      try {
        const { notes, notebooks } = await workspaceService.initWorkspace();
        this.notes = notes;
        this.notebooks = notebooks;

        // Keep current active note if it still exists, otherwise pick first
        if (this.activeNoteId && !this.notes.find((n) => n.id === this.activeNoteId)) {
          this.activeNoteId = notes[0]?.id ?? null;
        } else if (!this.activeNoteId) {
          this.activeNoteId = notes[0]?.id ?? null;
        }

        this.activeNotebookId = null;
        logger.info(`Workspace initialized with ${notes.length} note(s) and ${notebooks.length} notebook(s).`);
      } catch (err: unknown) {
        logger.error(`Failed to initialize workspace: ${err instanceof Error ? err.message : String(err)}`);
        this.notes = [];
        this.notebooks = [];
        this.activeNoteId = null;
        this.activeNotebookId = null;
      } finally {
        this.initialized = true;
      }
    },

    selectNote(id: string) {
      if (this.notes.some((note) => note.id === id)) {
        this.forceFlushAutoSave();
        this.activeNoteId = id;
        this.activeNotebookId = null;
        logger.info(`Selected note: ${id}`);
      }
    },

    selectNotebook(id: string) {
      if (this.notebooks.some((notebook) => notebook.id === id)) {
        this.forceFlushAutoSave();
        this.activeNotebookId = id;
        this.activeNoteId = null;
        logger.info(`Selected notebook: ${id}`);
      }
    },

    async createNote(parentId: string | null = null) {
      try {
        const newNote = await workspaceService.createNote(parentId);
        this.notes.push(newNote);
        this.activeNoteId = newNote.id;
        this.activeNotebookId = null;
        logger.info(`Created new note: ${newNote.id} with contentId ${newNote.contentId}`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`Failed to create note: ${message}`);
      }
    },

    async createNotebook(parentId: string | null = null) {
      try {
        const newNotebook = await workspaceService.createNotebook(parentId);
        this.notebooks.push(newNotebook);
        this.activeNotebookId = newNotebook.id;
        this.activeNoteId = null;
        logger.info(`Created new notebook: ${newNotebook.id}`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`Failed to create notebook: ${message}`);
      }
    },

    async renameNote(id: string, title: string) {
      const note = this.notes.find((candidate) => candidate.id === id);
      if (!note || !title.trim()) {
        return;
      }

      try {
        const { title: newTitle, content: newContent, updatedAt } = await workspaceService.renameNote(note, title);
        note.title = newTitle;
        note.content = newContent;
        note.updatedAt = updatedAt;
        logger.info(`Renamed note: ${id} -> ${newTitle}`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`Failed to rename note ${id}: ${message}`);
      }
    },

    async renameNotebook(id: string, name: string) {
      const notebook = this.notebooks.find((candidate) => candidate.id === id);
      if (!notebook || !name.trim()) {
        return;
      }

      try {
        const { name: newName, updatedAt } = await workspaceService.renameNotebook(id, name);
        notebook.name = newName;
        notebook.updatedAt = updatedAt;
        logger.info(`Renamed notebook: ${id} -> ${newName}`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`Failed to rename notebook ${id}: ${message}`);
      }
    },

    async updateActiveContent(content: string) {
      const note = this.notes.find((candidate) => candidate.id === this.activeNoteId);
      if (!note) return;

      if (note.content.replace(/\r\n/g, '\n') === content.replace(/\r\n/g, '\n')) {
        return;
      }

      note.content = content;
      note.updatedAt = Date.now();

      if (workspaceService.isAvailable()) {
        const noteId = note.id;
        const contentId = note.contentId;

        this.savingStatus = WORKSPACE_CONSTANTS.SAVE_STATUS.SAVING;
        this.saveError = null;

        clearTimeout(saveTimers.get(noteId));
        saveTimers.set(
          noteId,
          setTimeout(async () => {
            saveTimers.delete(noteId);
            const latest = this.notes.find((n) => n.id === noteId);
            if (!latest) return;

            try {
              const saved = await workspaceService.writeContent(contentId, latest.content, noteId);
              if (saved) {
                const savedAt = Date.now();
                this.savingStatus = WORKSPACE_CONSTANTS.SAVE_STATUS.SAVED;
                this.lastSaveTime = savedAt;
                this.lastSavedNoteMeta = {
                  noteId,
                  title: latest.title,
                  contentId,
                  savedAt,
                };
                logger.debug(`Updated content for note: ${noteId}`);

                setTimeout(() => {
                  if (this.savingStatus === WORKSPACE_CONSTANTS.SAVE_STATUS.SAVED) {
                    this.savingStatus = WORKSPACE_CONSTANTS.SAVE_STATUS.IDLE;
                  }
                }, WORKSPACE_CONSTANTS.AUTO_SAVE.STATUS_HIDE_DELAY);
              } else {
                this.savingStatus = WORKSPACE_CONSTANTS.SAVE_STATUS.ERROR;
                this.saveError = WORKSPACE_CONSTANTS.ERROR_MESSAGES.SAVE_FAILED;
                logger.warn(`Failed to persist content for note: ${noteId}`);
              }
            } catch (err: unknown) {
              this.savingStatus = WORKSPACE_CONSTANTS.SAVE_STATUS.ERROR;
              this.saveError = err instanceof Error ? err.message : WORKSPACE_CONSTANTS.ERROR_MESSAGES.UNKNOWN_ERROR;
              logger.error(`Error saving note ${noteId}: ${err instanceof Error ? err.message : String(err)}`);
            }
          }, WORKSPACE_CONSTANTS.AUTO_SAVE.DEBOUNCE_DELAY)
        );
      }
    },

    async forceFlushAutoSave() {
      const promises: Promise<boolean>[] = [];

      for (const [noteId, timer] of saveTimers.entries()) {
        clearTimeout(timer);
        saveTimers.delete(noteId);

        const note = this.notes.find((n) => n.id === noteId);
        if (note) {
          this.savingStatus = WORKSPACE_CONSTANTS.SAVE_STATUS.SAVING;
          promises.push(
            workspaceService.writeContent(note.contentId, note.content, noteId).then((saved) => {
              if (saved) {
                const savedAt = Date.now();
                this.savingStatus = WORKSPACE_CONSTANTS.SAVE_STATUS.SAVED;
                this.lastSaveTime = savedAt;
                this.lastSavedNoteMeta = {
                  noteId,
                  title: note.title,
                  contentId: note.contentId,
                  savedAt,
                };
              } else {
                this.savingStatus = WORKSPACE_CONSTANTS.SAVE_STATUS.ERROR;
              }
              return saved;
            })
          );
        }
      }

      await Promise.all(promises);
    },

    async showNoteInFolder(id: string) {
      const note = this.notes.find((candidate) => candidate.id === id);
      if (!note) {
        logger.warn(`Cannot show note in folder, note not found: ${id}`);
        return;
      }

      try {
        await workspaceService.showNoteInFolder(id);
        logger.info(`Revealed note in folder: ${id}`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`Failed to show note ${id} in folder: ${message}`);
      }
    },

    async deleteNote(id: string) {
      const index = this.notes.findIndex((note) => note.id === id);
      if (index === -1) return;

      try {
        await workspaceService.deleteNode(id);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`Failed to delete note ${id}: ${message}`);
        return;
      }

      this.notes = this.notes.filter((note) => note.id !== id);
      if (this.activeNoteId === id) {
        this.activeNoteId = this.notes[0]?.id ?? null;
      }
      logger.info(`Deleted note: ${id}`);
    },

    async deleteNotebook(id: string) {
      const notebook = this.notebooks.find((nb) => nb.id === id);
      if (!notebook) return;

      try {
        await workspaceService.deleteNode(id);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`Failed to delete notebook ${id}: ${message}`);
        return;
      }

      const getDescendantIds = (parentId: string): string[] => {
        const childNotes = this.notes.filter((n) => n.parentId === parentId).map((n) => n.id);
        const childNotebooks = this.notebooks.filter((nb) => nb.parentId === parentId);

        let descendantIds = [...childNotes];
        for (const childNb of childNotebooks) {
          descendantIds.push(childNb.id);
          descendantIds = descendantIds.concat(getDescendantIds(childNb.id));
        }
        return descendantIds;
      };

      const idsToRemove = new Set([id, ...getDescendantIds(id)]);

      this.notes = this.notes.filter((note) => !idsToRemove.has(note.id));
      this.notebooks = this.notebooks.filter((nb) => !idsToRemove.has(nb.id));

      if (idsToRemove.has(this.activeNoteId ?? '')) {
        this.activeNoteId = this.notes[0]?.id ?? null;
      }
      if (idsToRemove.has(this.activeNotebookId ?? '')) {
        this.activeNotebookId = null;
      }

      logger.info(`Deleted notebook and descendants: ${id} (Total items removed: ${idsToRemove.size})`);
    },

    async toggleNodeLock(id: string, locked: boolean) {
      try {
        const note = this.notes.find((n) => n.id === id);
        if (!note) {
          logger.warn(`Cannot lock node ${id}: not a note or not found.`);
          return;
        }

        await workspaceService.toggleNodeLock(id, locked);

        note.locked = locked;
        note.updatedAt = Date.now();

        logger.info(`${locked ? 'Locked' : 'Unlocked'} note: ${id}`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`Failed to toggle lock for note ${id}: ${message}`);
      }
    },

    async openHistoryDialog(noteId: string) {
      const note = this.notes.find(n => n.id === noteId);
      if (!note) return;
      
      this.activeNoteId = noteId;
      this.isHistoryDialogOpen = true;
      await this.fetchHistory(note.contentId);
    },

    closeHistoryDialog() {
      this.isHistoryDialogOpen = false;
      this.historyVersions = [];
    },

    async fetchHistory(contentId: string) {
      this.historyLoading = true;
      try {
        this.historyVersions = await workspaceService.getHistory(contentId);
      } catch (err: unknown) {
        logger.error(`Failed to fetch history for ${contentId}: ${err}`);
      } finally {
        this.historyLoading = false;
      }
    },

    async getHistoryContent(filename: string) {
      if (!this.activeNoteId) return '';
      const note = this.notes.find(n => n.id === this.activeNoteId);
      if (!note) return '';
      try {
        return await workspaceService.getHistoryContent(note.contentId, filename);
      } catch (err: unknown) {
        logger.error(`Failed to get history content: ${err}`);
        return '';
      }
    },

    async recoverVersion(filename: string) {
      if (!this.activeNoteId) return;
      
      try {
        const success = await workspaceService.recoverVersion(this.activeNoteId, filename);
        if (success) {
          await this.initializeWorkspace(true);
          this.closeHistoryDialog();
          logger.info(`Recovered note ${this.activeNoteId} to version ${filename}`);
        }
      } catch (err: unknown) {
        logger.error(`Failed to recover version: ${err}`);
      }
    },
  },
});
