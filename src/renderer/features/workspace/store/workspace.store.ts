import { defineStore } from 'pinia';
import { createLogger } from '@renderer/features/logger';
import type { HistoryVersion } from '@renderer/core/bridge/electronApi';
import { getErrorMessage } from '@shared/utils/error.utils';
import { workspaceService, type Note, type Notebook } from '../services/workspace.service';
import { WORKSPACE_CONSTANTS, type SaveStatus } from '../constants/workspace.constants';

const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
const logger = createLogger('Workspace Store');

function getDescendantIds(notes: Note[], notebooks: Notebook[], parentId: string): string[] {
  const childNotes = notes.filter((note) => note.parentId === parentId).map((note) => note.id);
  const childNotebooks = notebooks.filter((notebook) => notebook.parentId === parentId);

  let descendantIds = [...childNotes];
  for (const childNotebook of childNotebooks) {
    descendantIds.push(childNotebook.id);
    descendantIds = descendantIds.concat(getDescendantIds(notes, notebooks, childNotebook.id));
  }

  return descendantIds;
}

function compareNodeOrder(left: Pick<Note | Notebook, 'order' | 'createdAt' | 'id'>, right: Pick<Note | Notebook, 'order' | 'createdAt' | 'id'>): number {
  const leftOrder = Number(left.order ?? left.createdAt ?? 0);
  const rightOrder = Number(right.order ?? right.createdAt ?? 0);

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  if (left.createdAt !== right.createdAt) {
    return left.createdAt - right.createdAt;
  }

  return left.id.localeCompare(right.id);
}

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
      [...state.notes].sort(compareNodeOrder),

    sortedNotebooks: (state): Notebook[] =>
      [...state.notebooks].sort(compareNodeOrder),
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

        if (this.activeNoteId && !this.notes.find((note) => note.id === this.activeNoteId)) {
          this.activeNoteId = notes[0]?.id ?? null;
        } else if (!this.activeNoteId) {
          this.activeNoteId = notes[0]?.id ?? null;
        }

        this.activeNotebookId = null;
        logger.info(`Workspace initialized with ${notes.length} note(s) and ${notebooks.length} notebook(s).`);
      } catch (err: unknown) {
        logger.error(`Failed to initialize workspace: ${getErrorMessage(err)}`);
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
        const message = getErrorMessage(err);
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
        const message = getErrorMessage(err);
        logger.error(`Failed to create notebook: ${message}`);
      }
    },

    async moveNode(payload: { nodeId: string; parentId: string | null; index: number }) {
      try {
        await workspaceService.moveNode(payload);
      } catch (err: unknown) {
        const message = getErrorMessage(err);
        logger.error(`Failed to move node ${payload.nodeId}: ${message}`);
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
        const message = getErrorMessage(err);
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
        const message = getErrorMessage(err);
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
            const latest = this.notes.find((candidate) => candidate.id === noteId);
            if (!latest) return;

            try {
              const result = await workspaceService.saveNoteContent(noteId, contentId, latest.content);
              if (result.success) {
                latest.content = result.content;
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
              this.saveError = getErrorMessage(err, WORKSPACE_CONSTANTS.ERROR_MESSAGES.UNKNOWN_ERROR);
              logger.error(`Error saving note ${noteId}: ${getErrorMessage(err)}`);
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

        const note = this.notes.find((candidate) => candidate.id === noteId);
        if (note) {
          this.savingStatus = WORKSPACE_CONSTANTS.SAVE_STATUS.SAVING;
          promises.push(
            workspaceService.saveNoteContent(noteId, note.contentId, note.content).then((result) => {
              if (result.success) {
                note.content = result.content;
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
                this.saveError = WORKSPACE_CONSTANTS.ERROR_MESSAGES.SAVE_FAILED;
              }
              return result.success;
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
        const message = getErrorMessage(err);
        logger.error(`Failed to show note ${id} in folder: ${message}`);
      }
    },

    async deleteNote(id: string) {
      const index = this.notes.findIndex((note) => note.id === id);
      if (index === -1) return;

      try {
        await workspaceService.deleteNode(id);
      } catch (err: unknown) {
        const message = getErrorMessage(err);
        logger.error(`Failed to delete note ${id}: ${message}`);
        return;
      }

      this.notes = this.notes.filter((note) => note.id !== id);
      if (this.activeNoteId === id) {
        this.activeNoteId = this.notes[0]?.id ?? null;
      }
      logger.info(`Deleted note: ${id}`);
    },

    async confirmDeleteNote(id: string): Promise<boolean> {
      const note = this.notes.find((candidate) => candidate.id === id);
      if (!note) {
        return false;
      }

      const confirmed = await workspaceService.confirmDeleteNode(note.title);
      if (!confirmed) {
        return false;
      }

      await this.deleteNote(id);
      return true;
    },

    async deleteNotebook(id: string) {
      const notebook = this.notebooks.find((candidate) => candidate.id === id);
      if (!notebook) return;

      try {
        await workspaceService.deleteNode(id);
      } catch (err: unknown) {
        const message = getErrorMessage(err);
        logger.error(`Failed to delete notebook ${id}: ${message}`);
        return;
      }

      const idsToRemove = new Set([id, ...getDescendantIds(this.notes, this.notebooks, id)]);

      this.notes = this.notes.filter((note) => !idsToRemove.has(note.id));
      this.notebooks = this.notebooks.filter((candidate) => !idsToRemove.has(candidate.id));

      if (idsToRemove.has(this.activeNoteId ?? '')) {
        this.activeNoteId = this.notes[0]?.id ?? null;
      }
      if (idsToRemove.has(this.activeNotebookId ?? '')) {
        this.activeNotebookId = null;
      }

      logger.info(`Deleted notebook and descendants: ${id} (Total items removed: ${idsToRemove.size})`);
    },

    async confirmDeleteNotebook(id: string): Promise<boolean> {
      const notebook = this.notebooks.find((candidate) => candidate.id === id);
      if (!notebook) {
        return false;
      }

      const confirmed = await workspaceService.confirmDeleteNode(notebook.name);
      if (!confirmed) {
        return false;
      }

      await this.deleteNotebook(id);
      return true;
    },

    async toggleNodeLock(id: string, locked: boolean) {
      try {
        const note = this.notes.find((candidate) => candidate.id === id);
        if (!note) {
          logger.warn(`Cannot lock node ${id}: not a note or not found.`);
          return;
        }

        const result = await workspaceService.toggleNodeLock(id, locked);
        note.locked = result.locked;
        note.updatedAt = result.updatedAt;

        logger.info(`${locked ? 'Locked' : 'Unlocked'} note: ${id}`);
      } catch (err: unknown) {
        const message = getErrorMessage(err);
        logger.error(`Failed to toggle lock for note ${id}: ${message}`);
      }
    },

    async openHistoryDialog(noteId: string) {
      const note = this.notes.find((candidate) => candidate.id === noteId);
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
        logger.error(`Failed to fetch history for ${contentId}: ${getErrorMessage(err)}`);
      } finally {
        this.historyLoading = false;
      }
    },

    async getHistoryContent(filename: string) {
      if (!this.activeNoteId) return '';

      const note = this.notes.find((candidate) => candidate.id === this.activeNoteId);
      if (!note) return '';

      try {
        return await workspaceService.getHistoryContent(note.contentId, filename);
      } catch (err: unknown) {
        logger.error(`Failed to get history content: ${getErrorMessage(err)}`);
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
        logger.error(`Failed to recover version: ${getErrorMessage(err)}`);
      }
    },

    async confirmRecoverVersion(filename: string): Promise<boolean> {
      if (!this.activeNoteId) {
        return false;
      }

      const confirmed = await workspaceService.confirmRecoverVersion();
      if (!confirmed) {
        return false;
      }

      await this.recoverVersion(filename);
      return true;
    },

    async toggleNodeStar(id: string, type: 'note' | 'notebook', starred: boolean) {
      try {
        let node: Note | Notebook | undefined;
        if (type === 'note') {
          node = this.notes.find((candidate) => candidate.id === id);
        } else {
          node = this.notebooks.find((candidate) => candidate.id === id);
        }

        if (!node) {
          logger.warn(`Cannot star node ${id}: not found.`);
          return;
        }

        const result = await workspaceService.toggleNodeStar(id, starred);
        node.starred = result.starred;
        node.starredAt = result.starredAt;

        logger.info(`${starred ? 'Starred' : 'Unstarred'} ${type}: ${id}`);
      } catch (err: unknown) {
        const message = getErrorMessage(err);
        logger.error(`Failed to toggle star for node ${id}: ${message}`);
      }
    },
  },
});
