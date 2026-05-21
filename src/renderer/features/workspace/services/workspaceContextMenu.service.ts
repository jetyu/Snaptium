import type { Note, Notebook } from './workspace.service';
import { WORKSPACE_CONSTANTS } from '../constants/workspace.constants';
import { electronApi } from '@renderer/core/bridge/electronApi';
import { createLogger } from '@renderer/features/logger';

export type WorkspaceContextAction = string;

export interface WorkspaceMenuItem {
  action?: WorkspaceContextAction | null;
  labelKey?: string;
  label?: string;
  type?: 'normal' | 'separator' | 'submenu' | 'checkbox' | 'radio';
  enabled?: boolean;
  checked?: boolean;
  iconDataUrl?: string;
  submenu?: WorkspaceMenuItem[];
}

export interface WorkspaceMoveTarget {
  action: WorkspaceContextAction;
  label: string;
}

const logger = createLogger('Workspace Context Menu');
type Translate = (key: string, named?: Record<string, unknown>) => string;

function toPayloadItem(item: WorkspaceMenuItem): WorkspaceMenuItem {
  return {
    action: item.action ?? null,
    labelKey: item.labelKey,
    label: item.label,
    type: item.type ?? WORKSPACE_CONSTANTS.MENU_ITEM_TYPE.NORMAL,
    enabled: item.enabled,
    checked: item.checked,
    iconDataUrl: item.iconDataUrl,
    submenu: Array.isArray(item.submenu) ? item.submenu.map(toPayloadItem) : undefined,
  };
}

export async function showNativeWorkspaceContextMenu(t: Translate, items: WorkspaceMenuItem[]): Promise<WorkspaceContextAction | null> {
  const result = await electronApi.workspace.showContextMenu({
    labels: createWorkspaceContextMenuLabels(t),
    items: items.map(toPayloadItem),
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
    [WORKSPACE_CONSTANTS.MENU.MOVE_TO]: t(WORKSPACE_CONSTANTS.MENU.MOVE_TO),
    [WORKSPACE_CONSTANTS.MENU.MOVE_TO_ROOT]: t(WORKSPACE_CONSTANTS.MENU.MOVE_TO_ROOT),
    [WORKSPACE_CONSTANTS.MENU.SHOW_IN_FOLDER]: t(WORKSPACE_CONSTANTS.MENU.SHOW_IN_FOLDER),
    [WORKSPACE_CONSTANTS.MENU.PROPERTIES]: t(WORKSPACE_CONSTANTS.MENU.PROPERTIES),
    [WORKSPACE_CONSTANTS.MENU.HISTORY]: t(WORKSPACE_CONSTANTS.MENU.HISTORY),
    [WORKSPACE_CONSTANTS.MENU.STAR]: t(WORKSPACE_CONSTANTS.MENU.STAR),
    [WORKSPACE_CONSTANTS.MENU.UNSTAR]: t(WORKSPACE_CONSTANTS.MENU.UNSTAR),
    [WORKSPACE_CONSTANTS.MENU.NOTEBOOK_ICON_APPEARANCE]: t(WORKSPACE_CONSTANTS.MENU.NOTEBOOK_ICON_APPEARANCE),
  };
}

export function getCreateButtonMenu(): WorkspaceMenuItem[] {
  return [
    { action: WORKSPACE_CONSTANTS.ACTIONS.CREATE_NOTE, labelKey: WORKSPACE_CONSTANTS.MENU.NEW_NOTE },
    { action: WORKSPACE_CONSTANTS.ACTIONS.CREATE_NOTEBOOK, labelKey: WORKSPACE_CONSTANTS.MENU.NEW_NOTEBOOK }
  ];
}

export function createMoveToSubmenu(moveTargets: WorkspaceMoveTarget[]): WorkspaceMenuItem | null {
  if (moveTargets.length === 0) {
    return null;
  }

  return {
    type: WORKSPACE_CONSTANTS.MENU_ITEM_TYPE.SUBMENU,
    labelKey: WORKSPACE_CONSTANTS.MENU.MOVE_TO,
    submenu: moveTargets.map((target) => ({
      action: target.action,
      label: target.label,
    })),
  };
}

export function getRootWorkspaceMenu(): WorkspaceMenuItem[] {
  return [
    ...getCreateButtonMenu()
  ];
}

export function getNoteContextMenu(note: Note, moveTargets: WorkspaceMoveTarget[] = []): WorkspaceMenuItem[] {
  const moveToSubmenu = createMoveToSubmenu(moveTargets);
  return [
    { action: WORKSPACE_CONSTANTS.ACTIONS.TOGGLE_STAR, labelKey: note.starred ? WORKSPACE_CONSTANTS.MENU.UNSTAR : WORKSPACE_CONSTANTS.MENU.STAR },
    { action: WORKSPACE_CONSTANTS.ACTIONS.TOGGLE_LOCK, labelKey: note.locked ? WORKSPACE_CONSTANTS.MENU.UNLOCK : WORKSPACE_CONSTANTS.MENU.LOCK },
    { action: WORKSPACE_CONSTANTS.ACTIONS.RENAME, labelKey: WORKSPACE_CONSTANTS.MENU.RENAME },
    ...(moveToSubmenu
      ? [
        { type: WORKSPACE_CONSTANTS.MENU_ITEM_TYPE.SEPARATOR },
        moveToSubmenu,
      ]
      : []),
    { type: WORKSPACE_CONSTANTS.MENU_ITEM_TYPE.SEPARATOR },
    { action: WORKSPACE_CONSTANTS.ACTIONS.DELETE, labelKey: WORKSPACE_CONSTANTS.MENU.DELETE },
    { action: WORKSPACE_CONSTANTS.ACTIONS.HISTORY, labelKey: WORKSPACE_CONSTANTS.MENU.HISTORY },
    { action: WORKSPACE_CONSTANTS.ACTIONS.SHOW_IN_FOLDER, labelKey: WORKSPACE_CONSTANTS.MENU.SHOW_IN_FOLDER },
    { action: WORKSPACE_CONSTANTS.ACTIONS.PROPERTIES, labelKey: WORKSPACE_CONSTANTS.MENU.PROPERTIES }
  ];
}

export function getNotebookContextMenu(notebook: Notebook, moveTargets: WorkspaceMoveTarget[] = []): WorkspaceMenuItem[] {
  const moveToSubmenu = createMoveToSubmenu(moveTargets);
  return [
    { action: WORKSPACE_CONSTANTS.ACTIONS.TOGGLE_STAR, labelKey: notebook.starred ? WORKSPACE_CONSTANTS.MENU.UNSTAR : WORKSPACE_CONSTANTS.MENU.STAR },
    { action: WORKSPACE_CONSTANTS.ACTIONS.CREATE_NOTE, labelKey: WORKSPACE_CONSTANTS.MENU.NEW_NOTE },
    { action: WORKSPACE_CONSTANTS.ACTIONS.CREATE_NOTEBOOK, labelKey: WORKSPACE_CONSTANTS.MENU.NEW_NOTEBOOK },
    { action: WORKSPACE_CONSTANTS.ACTIONS.OPEN_NOTEBOOK_ICON_APPEARANCE, labelKey: WORKSPACE_CONSTANTS.MENU.NOTEBOOK_ICON_APPEARANCE },
    ...(moveToSubmenu
      ? [
        { type: WORKSPACE_CONSTANTS.MENU_ITEM_TYPE.SEPARATOR },
        moveToSubmenu,
      ]
      : []),
    { type: WORKSPACE_CONSTANTS.MENU_ITEM_TYPE.SEPARATOR },
    { action: WORKSPACE_CONSTANTS.ACTIONS.RENAME, labelKey: WORKSPACE_CONSTANTS.MENU.RENAME },
    { action: WORKSPACE_CONSTANTS.ACTIONS.DELETE, labelKey: WORKSPACE_CONSTANTS.MENU.DELETE }
  ];
}
