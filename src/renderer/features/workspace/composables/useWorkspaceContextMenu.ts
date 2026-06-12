import type { Note, Notebook } from '../services/workspace.service';
import { WORKSPACE_CONSTANTS } from '../constants/workspace.constants';
import { isNoteTemplateId, type NoteTemplateId } from '../templates';
import {
  getCreateButtonMenu,
  getNoteContextMenu,
  getNotebookContextMenu,
  getRootWorkspaceMenu,
  showNativeWorkspaceContextMenu,
  type WorkspaceContextAction,
  type WorkspaceMenuItem,
  type WorkspaceMoveTarget,
} from '../services/workspaceContextMenu.service';

interface UseWorkspaceContextMenuOptions {
  t: (key: string, named?: Record<string, string | number>) => string;
  createNote: (parentId?: string | null) => Promise<Note | null>;
  createNotebook: (parentId?: string | null) => Promise<void>;
  createNoteFromTemplate: (templateId: NoteTemplateId) => Promise<void>;
  moveNode: (payload: { nodeId: string; parentId: string | null; index: number }) => Promise<void>;
  showNoteInFolder: (id: string) => Promise<void>;
  deleteNote: (id: string) => Promise<unknown>;
  deleteNotebook: (id: string) => Promise<unknown>;
  getNoteMoveTargets: (note: Note) => WorkspaceMoveTarget[];
  getNotebookMoveTargets: (notebook: Notebook) => WorkspaceMoveTarget[];
  resolveMoveIndex: (parentId: string | null, excludeNodeId: string) => number;
  selectNote: (id: string) => void;
  selectNotebook: (id: string) => void;
  beginRenamingNote: (note: Note) => void;
  beginRenamingNotebook: (notebook: Notebook) => void;
  toggleNodeLock: (id: string, locked: boolean) => Promise<void>;
  openNotebookAppearancePicker: (notebook: Notebook) => void;
  toggleNodeStar: (id: string, type: 'note' | 'notebook', starred: boolean) => Promise<void>;
  openHistory: (id: string) => void;
}

function resolveContextParentId(entry: Note | Notebook, type: 'file' | 'folder') {
  return type === WORKSPACE_CONSTANTS.NODE_TYPE_FOLDER ? entry.id : entry.parentId ?? null;
}

function parseMoveAction(action: WorkspaceContextAction | null): { parentId: string | null } | null {
  if (!action || !action.startsWith(`${WORKSPACE_CONSTANTS.ACTIONS.MOVE_TO_PREFIX}:`)) {
    return null;
  }

  const encodedParentId = action.slice(WORKSPACE_CONSTANTS.ACTIONS.MOVE_TO_PREFIX.length + 1);
  return {
    parentId: encodedParentId === 'root' ? null : encodedParentId,
  };
}

function parseTemplateAction(action: WorkspaceContextAction | null): NoteTemplateId | null {
  if (!action || !action.startsWith(`${WORKSPACE_CONSTANTS.ACTIONS.CREATE_NOTE_FROM_TEMPLATE_PREFIX}:`)) {
    return null;
  }

  const templateId = action.slice(WORKSPACE_CONSTANTS.ACTIONS.CREATE_NOTE_FROM_TEMPLATE_PREFIX.length + 1);
  return isNoteTemplateId(templateId) ? templateId : null;
}

export function useWorkspaceContextMenu(options: UseWorkspaceContextMenuOptions) {
  async function showContextMenu(items: WorkspaceMenuItem[]) {
    return showNativeWorkspaceContextMenu(options.t, items);
  }

  async function runAction(
    action: WorkspaceContextAction | null,
    context: { parentId?: string | null; note?: Note; notebook?: Notebook } = {},
  ) {
    const moveTarget = parseMoveAction(action);
    if (moveTarget && (context.note || context.notebook)) {
      const nodeId = context.note?.id ?? context.notebook?.id;
      if (!nodeId) {
        return;
      }

      await options.moveNode({
        nodeId,
        parentId: moveTarget.parentId,
        index: options.resolveMoveIndex(moveTarget.parentId, nodeId),
      });
      return;
    }

    const templateId = parseTemplateAction(action);
    if (templateId) {
      await options.createNoteFromTemplate(templateId);
      return;
    }

    switch (action) {
      case WORKSPACE_CONSTANTS.ACTIONS.CREATE_NOTE:
        await options.createNote(context.parentId ?? null);
        break;
      case WORKSPACE_CONSTANTS.ACTIONS.CREATE_NOTEBOOK:
        await options.createNotebook(context.parentId ?? null);
        break;
      case WORKSPACE_CONSTANTS.ACTIONS.RENAME:
        if (context.note) {
          options.beginRenamingNote(context.note);
        } else if (context.notebook) {
          options.beginRenamingNotebook(context.notebook);
        }
        break;
      case WORKSPACE_CONSTANTS.ACTIONS.DELETE:
        if (context.note) {
          await options.deleteNote(context.note.id);
        } else if (context.notebook) {
          await options.deleteNotebook(context.notebook.id);
        }
        break;
      case WORKSPACE_CONSTANTS.ACTIONS.TOGGLE_LOCK:
        if (context.note) {
          await options.toggleNodeLock(context.note.id, !context.note.locked);
        } else if (context.notebook) {
          await options.toggleNodeLock(context.notebook.id, !context.notebook.locked);
        }
        break;
      case WORKSPACE_CONSTANTS.ACTIONS.TOGGLE_STAR:
        if (context.note) {
          await options.toggleNodeStar(context.note.id, 'note', !context.note.starred);
        } else if (context.notebook) {
          await options.toggleNodeStar(context.notebook.id, 'notebook', !context.notebook.starred);
        }
        break;
      case WORKSPACE_CONSTANTS.ACTIONS.PROPERTIES:
      case WORKSPACE_CONSTANTS.ACTIONS.SHOW_IN_FOLDER:
        if (context.note) {
          await options.showNoteInFolder(context.note.id);
        }
        break;
      case WORKSPACE_CONSTANTS.ACTIONS.HISTORY:
        if (context.note) {
          options.openHistory(context.note.id);
        }
        break;
      case WORKSPACE_CONSTANTS.ACTIONS.OPEN_NOTEBOOK_ICON_APPEARANCE:
        if (context.notebook) {
          options.openNotebookAppearancePicker(context.notebook);
        }
        break;
      default:
        break;
    }
  }

  async function openCreateButtonMenu() {
    const action = await showContextMenu(getCreateButtonMenu());
    await runAction(action, { parentId: null });
  }

  async function openRootMenu() {
    const action = await showContextMenu(getRootWorkspaceMenu());
    await runAction(action, { parentId: null });
  }

  async function openNoteMenu(note: Note) {
    options.selectNote(note.id);
    const action = await showContextMenu(getNoteContextMenu(note, options.getNoteMoveTargets(note)));
    await runAction(action, { note, parentId: resolveContextParentId(note, WORKSPACE_CONSTANTS.NODE_TYPE_FILE) });
  }

  async function openNotebookMenu(notebook: Notebook) {
    options.selectNotebook(notebook.id);
    const action = await showContextMenu(getNotebookContextMenu(notebook, options.getNotebookMoveTargets(notebook)));
    await runAction(action, { notebook, parentId: resolveContextParentId(notebook, WORKSPACE_CONSTANTS.NODE_TYPE_FOLDER) });
  }

  return {
    openCreateButtonMenu,
    openRootMenu,
    openNoteMenu,
    openNotebookMenu,
  };
}
