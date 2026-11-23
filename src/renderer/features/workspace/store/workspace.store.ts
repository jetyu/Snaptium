import { electronApi } from '@renderer/core/bridge/electronApi';
import { renderMarkdown } from '@renderer/core/markdown/markdownRenderer';
import { defineStore } from 'pinia';
import { useAppShellStore } from '@renderer/app/store/appShell.store';
import { i18n } from '@renderer/features/i18n';
import { createLogger } from '@renderer/features/logger';
import { useSettingsStore } from '@renderer/features/settings/store/settings.store';
import type { HistoryVersion } from '@renderer/core/bridge/electronApi';
import { getErrorMessage } from '@shared/utils/error.utils';
import {
  normalizeNoteTag,
  normalizeNoteTags,
  resolveWorkspaceDeletionSelection,
  workspaceService,
  type Note,
  type Notebook,
  type WorkspaceTreeSelectionEntry,
  type WorkspaceTreeSelectionNode,
} from '../services/workspace.service';
import { WORKSPACE_CONSTANTS, type SaveStatus } from '../constants/workspace.constants';

const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pendingSaves = new Map<string, Promise<void>>();
const dirtyNotes = new Map<string, number>();
const failedSaves = new Map<string, string>();
const SAVE_RETRY_DELAY_MS = 5000;
const logger = createLogger('Workspace Store');

export interface WorkspaceTagSummary {
  name: string;
  count: number;
  updatedAt: number;
}

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

function getNodeIdsToRemove(notes: Note[], notebooks: Notebook[], nodeIds: readonly string[]): Set<string> {
  const idsToRemove = new Set<string>();

  for (const id of nodeIds) {
    idsToRemove.add(id);
    for (const descendantId of getDescendantIds(notes, notebooks, id)) {
      idsToRemove.add(descendantId);
    }
  }

  return idsToRemove;
}

function createTreeSelectionNodes(notes: Note[], notebooks: Notebook[]): WorkspaceTreeSelectionNode[] {
  return [
    ...notebooks.map((notebook) => ({
      id: notebook.id,
      kind: 'notebook' as const,
      parentId: notebook.parentId,
      order: notebook.order,
      createdAt: notebook.createdAt,
    })),
    ...notes.map((note) => ({
      id: note.id,
      kind: 'note' as const,
      parentId: note.parentId,
      order: note.order,
      createdAt: note.createdAt,
    })),
  ];
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
      isNotePropertiesDialogOpen: false,
      notePropertiesTargetId: null as string | null,
      visibleTreeEntries: [] as WorkspaceTreeSelectionEntry[],
      collapsedNotebookIds: [] as string[],
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

    allTags: (state): WorkspaceTagSummary[] => {
      const tagMap = new Map<string, WorkspaceTagSummary>();

      for (const note of state.notes) {
        for (const tag of normalizeNoteTags(note.tags)) {
          const key = tag.toLocaleLowerCase();
          const existing = tagMap.get(key);

          if (existing) {
            existing.count += 1;
            existing.updatedAt = Math.max(existing.updatedAt, note.updatedAt);
          } else {
            tagMap.set(key, {
              name: tag,
              count: 1,
              updatedAt: note.updatedAt,
            });
          }
        }
      }

      return [...tagMap.values()].sort((left, right) => left.name.localeCompare(right.name));
    },

    notePropertiesTarget: (state): Note | null => {
      if (!state.notePropertiesTargetId) return null;
      return state.notes.find((note) => note.id === state.notePropertiesTargetId) ?? null;
    },
  },

  actions: {
    setCollapsedNotebookIds(ids: readonly string[]): void {
      this.collapsedNotebookIds = Array.from(new Set(ids));
    },

    setVisibleTreeEntries(entries: readonly WorkspaceTreeSelectionEntry[]): void {
      this.visibleTreeEntries = entries.map((entry) => ({
        id: entry.id,
        kind: entry.kind,
        parentId: entry.parentId,
      }));
    },

    applyTreeSelection(selection: WorkspaceTreeSelectionEntry | null): void {
      if (selection?.kind === 'note' && this.notes.some((note) => note.id === selection.id)) {
        this.activeNoteId = selection.id;
        this.activeNotebookId = null;
        return;
      }

      if (selection?.kind === 'notebook' && this.notebooks.some((notebook) => notebook.id === selection.id)) {
        this.activeNotebookId = selection.id;
        this.activeNoteId = null;
        return;
      }

      this.activeNoteId = null;
      this.activeNotebookId = null;
    },

    async initializeWorkspace(force = false) {
      if (this.initialized && !force) {
        return;
      }

      if (!window.__vfsListenerAdded) {
        window.addEventListener('vfs-changed', () => {
          logger.info('VFS change detected, refreshing workspace...');
          void this.initializeWorkspace(true);
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

        const activeNoteStillExists = this.activeNoteId
          ? this.notes.some((note) => note.id === this.activeNoteId)
          : false;
        const activeNotebookStillExists = this.activeNotebookId
          ? this.notebooks.some((notebook) => notebook.id === this.activeNotebookId)
          : false;

        if (activeNoteStillExists) {
          this.activeNotebookId = null;
        } else if (activeNotebookStillExists) {
          this.activeNoteId = null;
        } else {
          this.activeNoteId = notes[0]?.id ?? null;
          this.activeNotebookId = null;
        }

        if (this.notePropertiesTargetId && !notes.find((note) => note.id === this.notePropertiesTargetId)) {
          this.closeNotePropertiesDialog();
        }

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
        void this.forceFlushAutoSave().catch((error: unknown) => {
          logger.error(`Failed to flush notes: ${getErrorMessage(error)}`);
        });
        this.activeNoteId = id;
        this.activeNotebookId = null;
        logger.info(`Selected note: ${id}`);
      }
    },

    selectNotebook(id: string) {
      if (this.notebooks.some((notebook) => notebook.id === id)) {
        void this.forceFlushAutoSave().catch((error: unknown) => {
          logger.error(`Failed to flush notes: ${getErrorMessage(error)}`);
        });
        this.activeNotebookId = id;
        this.activeNoteId = null;
        logger.info(`Selected notebook: ${id}`);
      }
    },

    async createNote(parentId: string | null = null, title?: string, content?: string): Promise<Note | null> {
      try {
        const newNote = await workspaceService.createNote(parentId, title, content);
        this.notes.push(newNote);
        this.activeNoteId = newNote.id;
        this.activeNotebookId = null;
        logger.info(`Created new note: ${newNote.id} with contentId ${newNote.contentId}`);
        return newNote;
      } catch (err: unknown) {
        const message = getErrorMessage(err);
        logger.error(`Failed to create note: ${message}`);
        return null;
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

    async updateNoteTags(id: string, tags: string[]): Promise<void> {
      const note = this.notes.find((candidate) => candidate.id === id);
      if (!note) {
        logger.warn(`Cannot update tags for note ${id}: note not found.`);
        return;
      }

      const normalizedTags = normalizeNoteTags(tags);
      const currentTags = normalizeNoteTags(note.tags);
      const isUnchanged =
        normalizedTags.length === currentTags.length &&
        normalizedTags.every((tag, index) => tag === currentTags[index]);

      if (isUnchanged) {
        note.tags = currentTags;
        return;
      }

      try {
        const result = await workspaceService.updateNoteTags(id, normalizedTags);
        note.tags = result.tags;
        note.updatedAt = result.updatedAt;
        logger.info(`Updated tags for note: ${id}`);
      } catch (err: unknown) {
        const message = getErrorMessage(err);
        logger.error(`Failed to update tags for note ${id}: ${message}`);
      }
    },

    async updateActiveNoteTags(tags: string[]): Promise<void> {
      if (!this.activeNoteId) {
        return;
      }

      await this.updateNoteTags(this.activeNoteId, tags);
    },

    async addTagToActiveNote(tagName: string): Promise<void> {
      const note = this.activeNote;
      const tag = normalizeNoteTag(tagName);
      if (!note || !tag) {
        return;
      }

      await this.updateNoteTags(note.id, [...normalizeNoteTags(note.tags), tag]);
    },

    async removeTagFromActiveNote(tagName: string): Promise<void> {
      const note = this.activeNote;
      const tag = normalizeNoteTag(tagName);
      if (!note || !tag) {
        return;
      }

      const tagKey = tag.toLocaleLowerCase();
      await this.updateNoteTags(
        note.id,
        normalizeNoteTags(note.tags).filter((item) => item.toLocaleLowerCase() !== tagKey)
      );
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
        this.savingStatus = WORKSPACE_CONSTANTS.SAVE_STATUS.SAVING;
        failedSaves.delete(noteId);
        this.saveError = failedSaves.values().next().value ?? null;

        dirtyNotes.set(noteId, (dirtyNotes.get(noteId) ?? 0) + 1);
        this.scheduleNoteSave(noteId, WORKSPACE_CONSTANTS.AUTO_SAVE.DEBOUNCE_DELAY);
      }
    },

    async applyNoteContentUpdate(noteId: string, content: string): Promise<boolean> {
      const note = this.notes.find((candidate) => candidate.id === noteId);
      if (!note) {
        logger.warn(`Cannot apply note content update, note not found: ${noteId}`);
        return false;
      }

      try {
        await this.persistPendingNote(noteId);
        const originalContent = note.content;
        const result = await workspaceService.saveNoteContent(note.id, note.contentId, content);
        if (!result.success) {
          return false;
        }

        if (note.content !== originalContent) {
          await this.persistPendingNote(noteId);
          return false;
        }
        note.content = result.content;
        note.updatedAt = Date.now();
        this.activeNoteId = note.id;
        this.activeNotebookId = null;
        this.savingStatus = WORKSPACE_CONSTANTS.SAVE_STATUS.SAVED;
        this.lastSaveTime = Date.now();
        this.lastSavedNoteMeta = {
          noteId: note.id,
          title: note.title,
          contentId: note.contentId,
          savedAt: this.lastSaveTime,
        };
        return true;
      } catch (err: unknown) {
        const message = getErrorMessage(err);
        logger.error(`Failed to apply note content update ${noteId}: ${message}`);
        return false;
      }
    },

    scheduleNoteSave(noteId: string, delay: number): void {
      clearTimeout(saveTimers.get(noteId));
      saveTimers.set(noteId, setTimeout(() => {
        saveTimers.delete(noteId);
        void this.persistPendingNote(noteId).catch((error: unknown) => {
          logger.error(`Error saving note ${noteId}: ${getErrorMessage(error)}`);
        });
      }, delay));
    },

    async persistPendingNote(noteId: string): Promise<void> {
      const pending = pendingSaves.get(noteId);
      if (pending) {
        await pending;
        if (dirtyNotes.has(noteId)) await this.persistPendingNote(noteId);
        return;
      }
      const task = (async (): Promise<void> => {
        while (dirtyNotes.has(noteId)) {
          const note = this.notes.find((candidate) => candidate.id === noteId);
          if (!note) {
            dirtyNotes.delete(noteId);
            failedSaves.delete(noteId);
            this.saveError = failedSaves.values().next().value ?? null;
            return;
          }
          const revision = dirtyNotes.get(noteId);
          const content = note.content;
          this.savingStatus = WORKSPACE_CONSTANTS.SAVE_STATUS.SAVING;
          try {
            const result = await workspaceService.saveNoteContent(noteId, note.contentId, content);
            if (!result.success) throw new Error(WORKSPACE_CONSTANTS.ERROR_MESSAGES.SAVE_FAILED);
            if (dirtyNotes.get(noteId) === revision) dirtyNotes.delete(noteId);
            const savedAt = Date.now();
            this.lastSaveTime = savedAt;
            this.lastSavedNoteMeta = { noteId, title: note.title, contentId: note.contentId, savedAt };
            failedSaves.delete(noteId);
            this.saveError = failedSaves.values().next().value ?? null;
            this.savingStatus = this.saveError
              ? WORKSPACE_CONSTANTS.SAVE_STATUS.ERROR
              : dirtyNotes.size > 0 ? WORKSPACE_CONSTANTS.SAVE_STATUS.SAVING : WORKSPACE_CONSTANTS.SAVE_STATUS.SAVED;
          } catch (error: unknown) {
            this.savingStatus = WORKSPACE_CONSTANTS.SAVE_STATUS.ERROR;
            this.saveError = getErrorMessage(error, WORKSPACE_CONSTANTS.ERROR_MESSAGES.UNKNOWN_ERROR);
            failedSaves.set(noteId, this.saveError);
            this.scheduleNoteSave(noteId, SAVE_RETRY_DELAY_MS);
            throw error;
          }
        }
      })();
      pendingSaves.set(noteId, task);
      try {
        await task;
      } finally {
        pendingSaves.delete(noteId);
      }
    },

    async forceFlushAutoSave(): Promise<void> {
      for (const timer of saveTimers.values()) clearTimeout(timer);
      saveTimers.clear();
      const results = await Promise.allSettled(
        [...new Set([...dirtyNotes.keys(), ...pendingSaves.keys()])]
          .map((noteId) => this.persistPendingNote(noteId)),
      );
      for (const result of results) {
        if (result.status === 'rejected') throw result.reason;
      }
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

    async deleteNote(id: string): Promise<boolean> {
      if (!this.notes.some((note) => note.id === id)) {
        return false;
      }

      const deleted = await this.deleteNodes([id]);
      if (deleted) {
        logger.info(`Deleted note: ${id}`);
      }
      return deleted;
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

      return await this.deleteNote(id);
    },

    async deleteNotebook(id: string): Promise<boolean> {
      if (!this.notebooks.some((notebook) => notebook.id === id)) {
        return false;
      }

      const descendantCount = getDescendantIds(this.notes, this.notebooks, id).length;
      const deleted = await this.deleteNodes([id]);
      if (deleted) {
        logger.info(`Deleted notebook and descendants: ${id} (Total items removed: ${descendantCount + 1})`);
      }
      return deleted;
    },

    async deleteNodes(ids: string[]): Promise<boolean> {
      const nodeIds = Array.from(new Set(ids));
      if (nodeIds.length === 0) {
        return false;
      }

      const idsToRemove = getNodeIdsToRemove(this.notes, this.notebooks, nodeIds);
      const activeId = this.activeNoteId ?? this.activeNotebookId;
      const activeSelectionWillBeRemoved = activeId !== null && idsToRemove.has(activeId);
      const nextSelection = activeSelectionWillBeRemoved
        ? resolveWorkspaceDeletionSelection({
          visibleEntries: this.visibleTreeEntries,
          allNodes: createTreeSelectionNodes(this.notes, this.notebooks),
          removedIds: idsToRemove,
          activeId,
        })
        : null;

      try {
        await workspaceService.deleteNodes(nodeIds);
      } catch (err: unknown) {
        const message = getErrorMessage(err);
        logger.error(`Failed to delete selected nodes: ${message}`);
        return false;
      }

      this.notes = this.notes.filter((note) => !idsToRemove.has(note.id));
      this.notebooks = this.notebooks.filter((candidate) => !idsToRemove.has(candidate.id));

      if (activeSelectionWillBeRemoved) {
        this.applyTreeSelection(nextSelection);
      }
      if (idsToRemove.has(this.notePropertiesTargetId ?? '')) {
        this.closeNotePropertiesDialog();
      }

      logger.info(`Deleted selected nodes and descendants: ${nodeIds.length} root candidate(s), ${idsToRemove.size} total item(s) removed.`);
      return true;
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

      return await this.deleteNotebook(id);
    },

    async setNoteReadMode(id: string, enabled: boolean) {
      try {
        const note = this.notes.find((candidate) => candidate.id === id);
        if (!note) {
          logger.warn(`Cannot set read mode for note ${id}: note not found.`);
          return;
        }

        const result = await workspaceService.setNoteReadMode(id, enabled);
        note.locked = result.locked;
        note.updatedAt = result.updatedAt;

        logger.info(`${enabled ? 'Enabled' : 'Disabled'} read mode for note: ${id}`);
      } catch (err: unknown) {
        const message = getErrorMessage(err);
        logger.error(`Failed to set read mode for note ${id}: ${message}`);
      }
    },

    async updateNotebookIconColor(id: string, iconColor: Notebook['iconColor'] | null) {
      const notebook = this.notebooks.find((candidate) => candidate.id === id);
      if (!notebook) {
        logger.warn(`Cannot update notebook icon color, notebook not found: ${id}`);
        return;
      }

      try {
        const result = await workspaceService.updateNotebookIconColor(id, iconColor ?? null);
        notebook.iconColor = result.iconColor;
        notebook.updatedAt = result.updatedAt;
        logger.info(`Updated notebook icon color: ${id} -> ${result.iconColor ?? 'default'}`);
      } catch (err: unknown) {
        logger.error(`Failed to update notebook icon color for ${id}: ${getErrorMessage(err)}`);
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

    openNotePropertiesDialog(noteId: string) {
      const note = this.notes.find((candidate) => candidate.id === noteId);
      if (!note) {
        logger.warn(`Cannot open note properties, note not found: ${noteId}`);
        return;
      }

      this.activeNoteId = noteId;
      this.notePropertiesTargetId = noteId;
      this.isNotePropertiesDialogOpen = true;
    },

    closeNotePropertiesDialog() {
      this.isNotePropertiesDialogOpen = false;
      this.notePropertiesTargetId = null;
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

    async openExternalFile(): Promise<void> {
      if (!electronApi.menu.isAvailable()) {
        logger.warn('Cannot open external file: electronAPI unavailable.');
        return;
      }

      try {
        // 调用原有 openFile IPC，弹出系统文件选择框（在 ipc/modules/editor.ts 中注册）
        const result = await electronApi.openFile();
        if (!result) {
          // 用户取消
          return;
        }

        const { filePath, content } = result;
        const fileName = filePath.split(/[\\/]/).pop() ?? 'Imported File';
        // 去掉后缀作为笔记标题
        const title = fileName.replace(/\.(md|txt)$/i, '');

        const newNote = await workspaceService.createNote(null, title, content);

        const index = this.notes.findIndex((n) => n.id === newNote.id);
        if (index === -1) {
          this.notes.push(newNote);
        } else {
          this.notes[index] = newNote;
        }

        this.activeNoteId = newNote.id;
        this.activeNotebookId = null;

        const appShellStore = useAppShellStore();
        await appShellStore.setActiveMainView('workspace');

        logger.info(`Imported external file as note: ${newNote.id} (from ${filePath})`);
      } catch (err: unknown) {
        logger.error(`Failed to open external file: ${getErrorMessage(err)}`);
      }
    },

    async importMarkdown() {
      if (!electronApi.dataTransfer.isAvailable()) return;
      try {
        const result = await electronApi.dataTransfer.importMarkdown();
        if (result.success && result.importedNotes! > 0) {
          await this.initializeWorkspace(true);
        }
      } catch (err: unknown) {
        logger.error(`Failed to import markdown: ${getErrorMessage(err)}`);
      }
    },

    async importEnex() {
      if (!electronApi.dataTransfer.isAvailable()) return;
      try {
        const result = await electronApi.dataTransfer.importEnex();
        // Result is MarkdownImportResult as ENEX import delegates to Markdown import
        if (result.success && (result.importedNotes ?? 0) > 0) {
          await this.initializeWorkspace(true);
        }
      } catch (err: unknown) {
        logger.error(`Failed to import enex: ${getErrorMessage(err)}`);
      }
    },

    async importSppx() {
      if (!electronApi.dataTransfer.isAvailable()) return;
      try {
        const result = await electronApi.dataTransfer.importSppx();
        if (result.success) {
          await this.initializeWorkspace(true);
        }
      } catch (err: unknown) {
        logger.error(`Failed to import sppx: ${getErrorMessage(err)}`);
      }
    },

    async importNwp() {
      if (!electronApi.dataTransfer.isAvailable()) return;
      try {
        const result = await electronApi.dataTransfer.importNwp();
        if (result.success && (result.stats?.imported ?? 0) > 0) {
          await this.initializeWorkspace(true);
        }
      } catch (err: unknown) {
        logger.error(`Failed to import nwp: ${getErrorMessage(err)}`);
      }
    },

    async exportMarkdown() {
      if (!electronApi.dataTransfer.isAvailable()) return;
      try {
        await electronApi.dataTransfer.exportMarkdown();
      } catch (err: unknown) {
        logger.error(`Failed to export markdown: ${getErrorMessage(err)}`);
      }
    },

    async exportSppx() {
      if (!electronApi.dataTransfer.isAvailable()) return;
      try {
        await electronApi.dataTransfer.exportSppx();
      } catch (err: unknown) {
        logger.error(`Failed to export sppx: ${getErrorMessage(err)}`);
      }
    },

    async exportNotePdf(id: string): Promise<void> {
      if (!electronApi.dataTransfer.isAvailable()) {
        return;
      }

      const note = this.notes.find((candidate) => candidate.id === id);
      if (!note) {
        logger.warn(`Cannot export note PDF, note not found: ${id}`);
        return;
      }

      const settingsStore = useSettingsStore();
      const t = i18n.global.t.bind(i18n.global);

      try {
        await this.forceFlushAutoSave();
        const html = renderMarkdown(note.content, {
          allowHtml: settingsStore.config.preview.allowHtml,
          allowInlineSvg: settingsStore.config.preview.allowInlineSvg,
          remoteImageMode: settingsStore.config.preview.remoteImageMode,
          trustedRemoteImageHosts: settingsStore.config.preview.trustedRemoteImageHosts,
          blockedImageLabel: t('preview.remoteImageBlocked'),
          copyCodeButtonLabel: t('preview.copyCode'),
          contentId: note.contentId,
          workspaceRoot: workspaceService.getCurrentWorkspaceRoot(),
        });

        const result = await electronApi.dataTransfer.exportNotePdf({
          title: note.title,
          html,
        });

        if (result.cancelled) {
          return;
        }

        if (!result.success) {
          throw new Error(t('dataTransfer.message.failed'));
        }

        await electronApi.settings.showMessage({
          type: 'info',
          title: t('dataTransfer.notePdfExport.dialogTitle'),
          message: result.filePath
            ? `${t('dataTransfer.message.notePdfExportSuccess')} ${result.filePath}`
            : t('dataTransfer.message.notePdfExportSuccess'),
        });
      } catch (err: unknown) {
        logger.error(`Failed to export note PDF: ${getErrorMessage(err)}`);
        await electronApi.settings.showMessage({
          type: 'error',
          title: t('dataTransfer.notePdfExport.dialogTitle'),
          message: t('dataTransfer.message.failed'),
          detail: getErrorMessage(err, t('common.unknown')),
        });
      }
    },
  },
});
