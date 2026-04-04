import type { Note, Notebook } from './workspace.service';
import { WORKSPACE_CONSTANTS } from '../constants/workspace.constants';
import { electronApi } from '@renderer/core/bridge/electronApi';
import { createLogger } from '@renderer/features/logger';

export type WorkspaceContextAction = typeof WORKSPACE_CONSTANTS.ACTIONS[keyof typeof WORKSPACE_CONSTANTS.ACTIONS];

export interface WorkspaceMenuItem {
  action?: WorkspaceContextAction;
  labelKey?: string;
  type?: 'normal' | 'separator';
}
const logger = createLogger('Workspace Context Menu');
type Translate = (key: string, named?: Record<string, unknown>) => string;

export async function showNativeWorkspaceContextMenu(t: Translate, items: WorkspaceMenuItem[]): Promise<WorkspaceContextAction | null> {
  const result = await electronApi.workspace.showContextMenu({
    labels: createWorkspaceContextMenuLabels(t),
    items: items.map((item) => ({
      action: item.action ?? WORKSPACE_CONSTANTS.ACTIONS.NOOP,
      labelKey: item.labelKey,
      type: item.type ?? 'normal',
    })),
  });

  if (result === null) {
    logger.warn('electronAPI.workspace not available, cannot show native workspace context menu.');
  }

  return result as WorkspaceContextAction | null;
}

export function createWorkspaceContextMenuLabels(t: Translate) {
  return {
    [WORKSPACE_CONSTANTS.MENU.NEW_NOTE]: t(WORKSPACE_CONSTANTS.MENU.NEW_NOTE),
    [WORKSPACE_CONSTANTS.MENU.NEW_NOTEBOOK]: t(WORKSPACE_CONSTANTS.MENU.NEW_NOTEBOOK),
    [WORKSPACE_CONSTANTS.MENU.RENAME]: t(WORKSPACE_CONSTANTS.MENU.RENAME),
    [WORKSPACE_CONSTANTS.MENU.DELETE]: t(WORKSPACE_CONSTANTS.MENU.DELETE),
    [WORKSPACE_CONSTANTS.MENU.LOCK]: t(WORKSPACE_CONSTANTS.MENU.LOCK),
    [WORKSPACE_CONSTANTS.MENU.UNLOCK]: t(WORKSPACE_CONSTANTS.MENU.UNLOCK),
    [WORKSPACE_CONSTANTS.MENU.SHOW_IN_FOLDER]: t(WORKSPACE_CONSTANTS.MENU.SHOW_IN_FOLDER),
    [WORKSPACE_CONSTANTS.MENU.PROPERTIES]: t(WORKSPACE_CONSTANTS.MENU.PROPERTIES),
    [WORKSPACE_CONSTANTS.MENU.HISTORY]: t(WORKSPACE_CONSTANTS.MENU.HISTORY)
  };
}

export function getCreateButtonMenu(): WorkspaceMenuItem[] {
  return [
    { action: WORKSPACE_CONSTANTS.ACTIONS.CREATE_NOTE, labelKey: WORKSPACE_CONSTANTS.MENU.NEW_NOTE },
    { action: WORKSPACE_CONSTANTS.ACTIONS.CREATE_NOTEBOOK, labelKey: WORKSPACE_CONSTANTS.MENU.NEW_NOTEBOOK }
  ];
}

export function getRootWorkspaceMenu(): WorkspaceMenuItem[] {
  return [
    ...getCreateButtonMenu()
  ];
}

export function getNoteContextMenu(note: Note): WorkspaceMenuItem[] {
  return [
    { action: WORKSPACE_CONSTANTS.ACTIONS.TOGGLE_LOCK, labelKey: note.locked ? WORKSPACE_CONSTANTS.MENU.UNLOCK : WORKSPACE_CONSTANTS.MENU.LOCK },
    { action: WORKSPACE_CONSTANTS.ACTIONS.RENAME, labelKey: WORKSPACE_CONSTANTS.MENU.RENAME },
    { action: WORKSPACE_CONSTANTS.ACTIONS.DELETE, labelKey: WORKSPACE_CONSTANTS.MENU.DELETE },
    { action: WORKSPACE_CONSTANTS.ACTIONS.HISTORY, labelKey: WORKSPACE_CONSTANTS.MENU.HISTORY },
    { action: WORKSPACE_CONSTANTS.ACTIONS.SHOW_IN_FOLDER, labelKey: WORKSPACE_CONSTANTS.MENU.SHOW_IN_FOLDER },
    { action: WORKSPACE_CONSTANTS.ACTIONS.PROPERTIES, labelKey: WORKSPACE_CONSTANTS.MENU.PROPERTIES }
  ];
}

export function getNotebookContextMenu(_notebook: Notebook): WorkspaceMenuItem[] {
  return [
    { action: WORKSPACE_CONSTANTS.ACTIONS.CREATE_NOTE, labelKey: WORKSPACE_CONSTANTS.MENU.NEW_NOTE },
    { action: WORKSPACE_CONSTANTS.ACTIONS.CREATE_NOTEBOOK, labelKey: WORKSPACE_CONSTANTS.MENU.NEW_NOTEBOOK },
    { type: WORKSPACE_CONSTANTS.MENU_ITEM_TYPE.SEPARATOR },
    { action: WORKSPACE_CONSTANTS.ACTIONS.RENAME, labelKey: WORKSPACE_CONSTANTS.MENU.RENAME },
    { action: WORKSPACE_CONSTANTS.ACTIONS.DELETE, labelKey: WORKSPACE_CONSTANTS.MENU.DELETE }
  ];
}
