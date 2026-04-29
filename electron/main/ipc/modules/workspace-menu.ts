import { Menu, ipcMain, type BrowserWindow, type MenuItemConstructorOptions } from 'electron';
import { IPC_CHANNELS } from '../../constants/ipc.constants.js';
import { loggerService } from '../../services/logger.service.js';

const logger = loggerService.createLogger('Electron:Workspace Menu IPC');

type MenuAction = string | null;
type MenuItemType = 'normal' | 'separator';

interface WorkspaceContextMenuItemPayload {
  action?: string;
  labelKey?: string;
  label?: string;
  type?: MenuItemType;
  enabled?: boolean;
}

interface WorkspaceContextMenuPayload {
  labels?: Record<string, string>;
  items?: WorkspaceContextMenuItemPayload[];
}

function resolveLabel(item: WorkspaceContextMenuItemPayload, labels: Record<string, string>): string {
  if (item.labelKey && labels[item.labelKey]) {
    return labels[item.labelKey];
  }

  if (typeof item.label === 'string' && item.label.trim().length > 0) {
    return item.label;
  }

  if (typeof item.action === 'string' && item.action.trim().length > 0) {
    return item.action;
  }

  return '';
}

function buildTemplate(
  payload: WorkspaceContextMenuPayload = {},
  resolve: (action: MenuAction) => void,
): MenuItemConstructorOptions[] {
  const labels = payload.labels ?? {};
  const items = payload.items ?? [];

  return items.map((item): MenuItemConstructorOptions => {
    if (item.type === 'separator') {
      return { type: 'separator' };
    }

    const action = typeof item.action === 'string' ? item.action : null;
    return {
      id: action ?? undefined,
      label: resolveLabel(item, labels),
      enabled: item.enabled !== false && action !== null,
      click: action ? () => resolve(action) : undefined,
    };
  });
}

export function registerWorkspaceMenuIpcHandlers(mainWindow: BrowserWindow): void {
  ipcMain.removeHandler(IPC_CHANNELS.WORKSPACE_SHOW_CONTEXT_MENU);

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_SHOW_CONTEXT_MENU, async (_event, payload: unknown) => {
    logger.debug('Showing context menu for workspace');
    const normalizedPayload = (typeof payload === 'object' && payload !== null
      ? payload
      : {}) as WorkspaceContextMenuPayload;

    return new Promise<MenuAction>((resolve) => {
      let settled = false;
      const finalize = (action: MenuAction = null): void => {
        if (!settled) {
          settled = true;
          resolve(action);
        }
      };

      const menu = Menu.buildFromTemplate(buildTemplate(normalizedPayload, finalize));
      menu.popup({
        window: mainWindow,
        callback: () => finalize(null),
      });
    });
  });
}
