import {
  Menu,
  shell,
  app,
  type BrowserWindow,
  type MenuItemConstructorOptions,
} from 'electron';
import { $t, i18n } from './utils/i18n.js';
import { IPC_CHANNELS } from './constants/ipc.constants.js';

function isMacPlatform(): boolean {
  return process.platform === IPC_CHANNELS.PLATFORM_DARWIN_KERNEL;
}

function getMenuTemplate(mainWindow: BrowserWindow): MenuItemConstructorOptions[] {
  const template: MenuItemConstructorOptions[] = [];
  if (isMacPlatform()) {
    template.push(getAppMenu());
  }

  template.push(
    getFileMenu(mainWindow),
    getEditMenu(mainWindow),
    getViewMenu(),
    getWindowMenu(),
    getHelpMenu(mainWindow),
  );

  return template;
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

function getFileMenu(mainWindow: BrowserWindow): MenuItemConstructorOptions {
  const isMac = isMacPlatform();
  return {
    label: $t('menu.file'),
    submenu: [
      {
        label: $t('menu.file.preferences'),
        accelerator: isMac ? 'Cmd+,' : 'Ctrl+,',
        click: () => mainWindow.webContents.send('menu:open-preferences'),
      },
      { type: 'separator' },
      isMac ? { role: 'close' } : { role: 'quit', label: $t('menu.file.quit') },
    ],
  };
}

function getEditMenu(mainWindow: BrowserWindow): MenuItemConstructorOptions {
  const isMac = isMacPlatform();
  const macSpeechMenu: MenuItemConstructorOptions[] = [
    { role: 'pasteAndMatchStyle' },
    { role: 'delete' },
    { role: 'selectAll', label: $t('contextMenu.selectAll') },
    { type: 'separator' },
    {
      label: 'Speech',
      submenu: [
        { role: 'startSpeaking' },
        { role: 'stopSpeaking' },
      ],
    },
  ];
  const defaultMenu: MenuItemConstructorOptions[] = [
    { role: 'delete' },
    { type: 'separator' },
    { role: 'selectAll' },
  ];

  return {
    label: $t('menu.edit'),
    submenu: [
      { role: 'undo', label: $t('menu.edit.undo') },
      { role: 'redo', label: $t('menu.edit.redo') },
      { type: 'separator' },
      { role: 'cut', label: $t('menu.edit.cut') },
      { role: 'copy', label: $t('menu.edit.copy') },
      { role: 'paste', label: $t('menu.edit.paste') },
      ...(isMac ? macSpeechMenu : defaultMenu),
      { type: 'separator' },
      {
        label: $t('menu.edit.find'),
        accelerator: 'CmdOrCtrl+F',
        click: () => mainWindow.webContents.send('menu:find'),
      },
    ],
  };
}

function getViewMenu(): MenuItemConstructorOptions {
  return {
    label: $t('menu.view'),
    submenu: [
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools', label: $t('menu.help.devTools') },
      { type: 'separator' },
      { role: 'resetZoom', label: $t('menu.view.resetZoom') },
      { role: 'zoomIn', label: $t('menu.view.zoomIn') },
      { role: 'zoomOut', label: $t('menu.view.zoomOut') },
      { type: 'separator' },
      { role: 'togglefullscreen', label: $t('menu.view.fullScreen') },
    ],
  };
}

function getWindowMenu(): MenuItemConstructorOptions {
  const isMac = isMacPlatform();
  return {
    label: $t('menu.window'),
    submenu: [
      { role: 'minimize', label: $t('menu.window.minimize') },
      { role: 'zoom' },
      ...(isMac
        ? [
            { type: 'separator' as const },
            { role: 'front' as const },
            { type: 'separator' as const },
            { role: 'window' as const },
          ]
        : [{ role: 'close' as const, label: $t('menu.window.close') }]),
    ],
  };
}

function getHelpMenu(mainWindow: BrowserWindow): MenuItemConstructorOptions {
  return {
    role: 'help',
    label: $t('menu.help'),
    submenu: [
      {
        label: $t('menu.help.website'),
        click: async () => {
          await shell.openExternal('https://github.com/jetyu/NoteWizard');
        },
      },
      {
        label: $t('menu.help.update'),
        click: () => mainWindow.webContents.send('menu:check-for-updates'),
      },
      {
        label: $t('menu.help.feedback'),
        click: async () => {
          await shell.openExternal('https://github.com/jetyu/NoteWizard/issues');
        },
      },
      { type: 'separator' },
      {
        label: $t('menu.help.about'),
        click: () => mainWindow.webContents.send('menu:open-about'),
      },
    ],
  };
}

export function setupAppMenu(mainWindow: BrowserWindow, locale?: string): void {
  if (locale) {
    i18n.loadTranslations(locale);
  }

  const template = getMenuTemplate(mainWindow);
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
