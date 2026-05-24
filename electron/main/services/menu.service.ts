import {
  Menu,
  shell,
  app,
  type BrowserWindow,
  type MenuItemConstructorOptions,
} from 'electron';
import { $t, i18n } from '../utils/i18n.js';
import { IPC_CHANNELS } from '../constants/ipc.constants.js';
import { MENU_CONFIG, type MenuAction, type MenuItemConfig } from '../../shared/menu.config.js';

function isMacPlatform(): boolean {
  return process.platform === IPC_CHANNELS.PLATFORM_DARWIN_KERNEL;
}

function mapConfigToMenuItem(
  config: MenuItemConfig,
  mainWindow: BrowserWindow,
): MenuItemConstructorOptions {
  const item: MenuItemConstructorOptions = {
    label: config.labelKey ? $t(config.labelKey) : undefined,
    accelerator: config.accelerator,
    type: config.type,
  };

  if (config.role) {
    item.role = config.role as NonNullable<MenuItemConstructorOptions['role']>;
  }

  if (config.id && !config.role) {
    item.click = () => handleMenuAction(config.id!, mainWindow);
  }

  if (config.submenu) {
    item.submenu = config.submenu.map((sub) => mapConfigToMenuItem(sub, mainWindow));
  }

  return item;
}

function handleMenuAction(action: MenuAction, mainWindow: BrowserWindow) {
  switch (action) {
    case 'openFile':
      mainWindow.webContents.send(IPC_CHANNELS.MENU_OPEN_FILE);
      break;
    case 'importMarkdown':
      mainWindow.webContents.send(IPC_CHANNELS.MENU_IMPORT_MARKDOWN);
      break;
    case 'importEnex':
      mainWindow.webContents.send(IPC_CHANNELS.MENU_IMPORT_ENEX);
      break;
    case 'importSppx':
      mainWindow.webContents.send(IPC_CHANNELS.MENU_IMPORT_SPPX);
      break;
    case 'importNwp':
      mainWindow.webContents.send(IPC_CHANNELS.MENU_IMPORT_NWP);
      break;
    case 'exportMarkdown':
      mainWindow.webContents.send(IPC_CHANNELS.MENU_EXPORT_MARKDOWN);
      break;
    case 'exportSppx':
      mainWindow.webContents.send(IPC_CHANNELS.MENU_EXPORT_SPPX);
      break;
    case 'preferences':
      mainWindow.webContents.send(IPC_CHANNELS.MENU_OPEN_PREFERENCES);
      break;
    case 'update':
      mainWindow.webContents.send(IPC_CHANNELS.MENU_CHECK_FOR_UPDATES);
      break;
    case 'about':
      mainWindow.webContents.send(IPC_CHANNELS.MENU_OPEN_ABOUT);
      break;
    case 'activateLicense':
      mainWindow.webContents.send(IPC_CHANNELS.MENU_OPEN_LICENSE);
      break;
    case 'website':
      shell.openExternal('https://snaptium.com');
      break;
    case 'docs':
      shell.openExternal('https://snaptium.com/docs');
      break;
    case 'changelog':
      shell.openExternal('https://snaptium.com/changelog');
      break;
    case 'support':
      shell.openExternal('https://snaptium.com/support');
      break;
    case 'privacy':
      shell.openExternal('https://snaptium.com/legal/privacy');
      break;
    case 'terms':
      shell.openExternal('https://snaptium.com/legal/terms');
      break;
    case 'feedback':
      shell.openExternal('https://github.com/jetyu/NoteWizard/issues');
      break;
    default:
      break;
  }
}

function getAppMenu(): MenuItemConstructorOptions {
  return {
    label: app.name,
    submenu: [
      { role: 'about', label: $t('menu.help.about') },
      { type: 'separator' },
      { role: 'services' },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideOthers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit', label: $t('menu.file.quit') },
    ],
  };
}

export function setupAppMenu(mainWindow: BrowserWindow, locale?: string): void {
  if (locale) {
    i18n.loadTranslations(locale);
  }

  const template: MenuItemConstructorOptions[] = [];

  if (isMacPlatform()) {
    template.push(getAppMenu());
  }

  MENU_CONFIG.forEach((category) => {
    template.push({
      label: $t(category.labelKey),
      submenu: category.items.map((item) => mapConfigToMenuItem(item, mainWindow)),
    });
  });

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
