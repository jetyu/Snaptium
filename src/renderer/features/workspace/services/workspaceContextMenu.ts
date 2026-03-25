import type { Note, Notebook } from '../store/workspace.store';

export type WorkspaceContextAction =
  | 'create-note'
  | 'create-notebook'
  | 'rename'
  | 'delete'
  | 'toggle-lock'
  | 'show-in-folder'
  | 'properties';

export interface WorkspaceMenuItem {
  action?: WorkspaceContextAction;
  labelKey?: string;
  type?: 'normal' | 'separator';
}

type Translate = (key: string, named?: Record<string, unknown>) => string;

export function createWorkspaceContextMenuLabels(t: Translate) {
  return {
    'contextMenu.newNote': t('contextMenu.newNote'),
    'contextMenu.newNotebook': t('contextMenu.newNotebook'),
    'contextMenu.rename': t('contextMenu.rename'),
    'contextMenu.delete': t('contextMenu.delete'),
    'contextMenu.lock': t('contextMenu.lock'),
    'contextMenu.unlock': t('contextMenu.unlock'),
    'contextMenu.showInFolder': t('contextMenu.showInFolder'),
    'contextMenu.properties': t('contextMenu.properties'),
  };
}

export function getCreateButtonMenu(): WorkspaceMenuItem[] {
  return [
    { action: 'create-note', labelKey: 'contextMenu.newNote' },
    { action: 'create-notebook', labelKey: 'contextMenu.newNotebook' },
  ];
}

export function getRootWorkspaceMenu(): WorkspaceMenuItem[] {
  return [
    ...getCreateButtonMenu()
  ];
}

export function getNoteContextMenu(_note: Note): WorkspaceMenuItem[] {
  return [
    { action: 'rename', labelKey: 'contextMenu.rename' },
    { action: 'delete', labelKey: 'contextMenu.delete' },
    { action: 'toggle-lock', labelKey: _note.locked ? 'contextMenu.unlock' : 'contextMenu.lock' },
    { action: 'show-in-folder', labelKey: 'contextMenu.showInFolder' },
    { action: 'properties', labelKey: 'contextMenu.properties' },
  ];
}

export function getNotebookContextMenu(_notebook: Notebook): WorkspaceMenuItem[] {
  return [
    { action: 'create-note', labelKey: 'contextMenu.newNote' },
    { action: 'create-notebook', labelKey: 'contextMenu.newNotebook' },
    { type: 'separator' },
    { action: 'rename', labelKey: 'contextMenu.rename' },
    { action: 'delete', labelKey: 'contextMenu.delete' },
    { action: 'properties', labelKey: 'contextMenu.properties' },
  ];
}
