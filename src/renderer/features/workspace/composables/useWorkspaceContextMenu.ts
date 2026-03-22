import { logger } from '@renderer/features/logger';
import type { Note, Notebook } from '../store/workspace.store';
import {
  createWorkspaceContextMenuLabels,
  getCreateButtonMenu,
  getNoteContextMenu,
  getNotebookContextMenu,
  getRootWorkspaceMenu,
  type WorkspaceContextAction,
  type WorkspaceMenuItem,
} from '../services/workspaceContextMenu';

interface UseWorkspaceContextMenuOptions {
  t: (key: string, named?: Record<string, unknown>) => string;
  createNote: (parentId?: string | null) => Promise<void>;
  createNotebook: (parentId?: string | null) => Promise<void>;
  selectNote: (id: string) => void;
  selectNotebook: (id: string) => void;
  beginRenamingNote: (note: Note) => void;
  beginRenamingNotebook: (notebook: Notebook) => void;
}

function resolveContextParentId(entry: Note | Notebook, type: 'file' | 'folder') {
  return type === 'folder' ? entry.id : entry.parentId ?? null;
}

export function useWorkspaceContextMenu(options: UseWorkspaceContextMenuOptions) {
  const labels = createWorkspaceContextMenuLabels(options.t);

  async function showContextMenu(items: WorkspaceMenuItem[]) {
    if (!window.electronAPI?.workspace) {
      logger.warn('electronAPI.workspace not available, cannot show native workspace context menu.');
      return null;
    }

    return window.electronAPI.workspace.showContextMenu({
      labels,
      items: items.map((item) => ({
        action: item.action ?? 'noop',
        labelKey: item.labelKey,
        type: item.type ?? 'normal',
      })),
    }) as Promise<WorkspaceContextAction | null>;
  }

  async function runAction(
    action: WorkspaceContextAction | null,
    context: { parentId?: string | null; note?: Note; notebook?: Notebook } = {},
  ) {
    switch (action) {
      case 'create-note':
        await options.createNote(context.parentId ?? null);
        break;
      case 'create-notebook':
        await options.createNotebook(context.parentId ?? null);
        break;
      case 'rename':
        if (context.note) {
          options.beginRenamingNote(context.note);
        } else if (context.notebook) {
          options.beginRenamingNotebook(context.notebook);
        }
        break;
      case 'delete':
      case 'toggle-lock':
      case 'show-in-folder':
      case 'properties':
        logger.info(`Workspace context menu action selected: ${action}`);
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
    const action = await showContextMenu(getNoteContextMenu(note));
    await runAction(action, { note, parentId: resolveContextParentId(note, 'file') });
  }

  async function openNotebookMenu(notebook: Notebook) {
    options.selectNotebook(notebook.id);
    const action = await showContextMenu(getNotebookContextMenu(notebook));
    await runAction(action, { notebook, parentId: resolveContextParentId(notebook, 'folder') });
  }

  return {
    openCreateButtonMenu,
    openRootMenu,
    openNoteMenu,
    openNotebookMenu,
  };
}
