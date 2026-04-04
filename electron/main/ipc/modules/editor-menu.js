import { Menu, ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../constants/ipc.constants.js';
import { loggerService } from '../../services/logger.service.js';

const logger = loggerService.createLogger('Electron:Editor Menu IPC');

function buildTemplate(payload = {}, resolve) {
  const labels = payload.labels ?? {};
  const items = payload.items ?? [];

  return items.map((item) => {
    if (item.type === 'separator') {
      return { type: 'separator' };
    }

    if (item.type === 'submenu' && item.submenu) {
      return {
        id: item.action,
        label: labels[item.labelKey] ?? item.label ?? item.action,
        submenu: item.submenu.map((subItem) => {
          if (subItem.type === 'separator') {
            return { type: 'separator' };
          }
          return {
            id: subItem.action,
            label: labels[subItem.labelKey] ?? subItem.label ?? subItem.action,
            enabled: subItem.enabled !== false,
            click: () => resolve(subItem.action),
          };
        }),
      };
    }

    return {
      id: item.action,
      label: labels[item.labelKey] ?? item.label ?? item.action,
      enabled: item.enabled !== false,
      click: () => resolve(item.action),
    };
  });
}

export function registerEditorMenuIpcHandlers(mainWindow) {
  ipcMain.removeHandler(IPC_CHANNELS.EDITOR_SHOW_CONTEXT_MENU);

  ipcMain.handle(IPC_CHANNELS.EDITOR_SHOW_CONTEXT_MENU, async (_event, payload = {}) => {
    logger.debug('Showing context menu for editor');
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
