import { Menu, ipcMain } from 'electron';
import { IPC_CHANNELS } from '../constants/channels.constants.js';

function buildTemplate(payload = {}, resolve) {
  const labels = payload.labels ?? {};
  const items = payload.items ?? [];

  return items.map((item) => {
    if (item.type === 'separator') {
      return { type: 'separator' };
    }

    return {
      id: item.action,
      label: labels[item.labelKey] ?? item.label ?? item.action,
      enabled: item.enabled !== false,
      click: () => resolve(item.action),
    };
  });
}

export function registerWorkspaceMenuIpcHandlers(mainWindow) {
  ipcMain.removeHandler(IPC_CHANNELS.WORKSPACE_SHOW_CONTEXT_MENU);

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_SHOW_CONTEXT_MENU, async (_event, payload = {}) => {
    return new Promise((resolve) => {
      let settled = false;
      const finalize = (action = null) => {
        if (!settled) {
          settled = true;
          resolve(action);
        }
      };

      const menu = Menu.buildFromTemplate(buildTemplate(payload, finalize));
      menu.popup({
        window: mainWindow,
        callback: () => finalize(null),
      });
    });
  });
}
