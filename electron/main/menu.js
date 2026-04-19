import { Menu, shell, app } from 'electron';
import { $t, i18n } from './utils/i18n.js';
import { IPC_CHANNELS } from './constants/ipc.constants.js';
/**
 * Builds the application menu template.
 * @param {Electron.BrowserWindow} mainWindow
 * @returns {Electron.MenuItemConstructorOptions[]}
 */
function getMenuTemplate(mainWindow) {
  const isMac = process.platform === IPC_CHANNELS.PLATFORM_DARWIN_KERNEL;

  return [
    ...(isMac ? [getAppMenu()] : []),
    getFileMenu(mainWindow),
    getEditMenu(mainWindow),
    getViewMenu(mainWindow),
    getWindowMenu(),
    getHelpMenu(mainWindow)
  ];
}

/**
 * Application menu (macOS only)
 */
function getAppMenu() {
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
      { role: 'quit', label: $t('menu.file.quit') }
    ]
  };
}

/**
 * File menu
 */
function getFileMenu(mainWindow) {
  const isMac = process.platform === IPC_CHANNELS.PLATFORM_DARWIN_KERNEL;
  return {
    label: $t('menu.file'),
    submenu: [
      {
        label: $t('menu.file.importNotes'),
        click: () => mainWindow.webContents.send('menu:import-notes')
      },
      {
        label: $t('menu.file.exportNotes'),
        click: () => mainWindow.webContents.send('menu:export-notes')
      },
      { type: 'separator' },
      {
        label: $t('menu.file.preferences'),
        accelerator: isMac ? 'Cmd+,' : 'Ctrl+,',
        click: () => mainWindow.webContents.send('menu:open-preferences')
      },
      { type: 'separator' },
      isMac ? { role: 'close' } : { role: 'quit', label: $t('menu.file.quit') }
    ]
  };
}

/**
 * Edit menu
 */
function getEditMenu(mainWindow) {
  const isMac = process.platform === IPC_CHANNELS.PLATFORM_DARWIN_KERNEL;
  return {
    label: $t('menu.edit'),
    submenu: [
      { role: 'undo', label: $t('menu.edit.undo') },
      { role: 'redo', label: $t('menu.edit.redo') },
      { type: 'separator' },
      { role: 'cut', label: $t('menu.edit.cut') },
      { role: 'copy', label: $t('menu.edit.copy') },
      { role: 'paste', label: $t('menu.edit.paste') },
      ...(isMac ? [
        { role: 'pasteAndMatchStyle' },
        { role: 'delete' },
        { role: 'selectAll', label: $t('contextMenu.selectAll') },
        { type: 'separator' },
        {
          label: 'Speech',
          submenu: [
            { role: 'startSpeaking' },
            { role: 'stopSpeaking' }
          ]
        }
      ] : [
        { role: 'delete' },
        { type: 'separator' },
        { role: 'selectAll' }
      ]),
      { type: 'separator' },
      {
        label: $t('menu.edit.find'),
        accelerator: 'CmdOrCtrl+F',
        click: () => mainWindow.webContents.send('menu:find')
      }
    ]
  };
}

/**
 * View menu
 */
function getViewMenu(_mainWindow) {
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
      { role: 'togglefullscreen', label: $t('menu.view.fullScreen') }
    ]
  };
}

/**
 * Window menu
 */
function getWindowMenu() {
  const isMac = process.platform === IPC_CHANNELS.PLATFORM_DARWIN_KERNEL;
  return {
    label: $t('menu.window'),
    submenu: [
      { role: 'minimize', label: $t('menu.window.minimize') },
      { role: 'zoom' },
      ...(isMac ? [
        { type: 'separator' },
        { role: 'front' },
        { type: 'separator' },
        { role: 'window' }
      ] : [
        { role: 'close', label: $t('menu.window.close') }
      ])
    ]
  };
}

/**
 * Help menu
 */
function getHelpMenu(mainWindow) {
  return {
    role: 'help',
    label: $t('menu.help'),
    submenu: [
      {
        label: $t('menu.help.website'),
        click: async () => {
          await shell.openExternal('https://github.com/jetyu/NoteWizard');
        }
      },
      {
        label: $t('menu.help.update'),
        click: () => mainWindow.webContents.send('menu:check-for-updates')
      },
      {
        label: $t('menu.help.feedback'),
        click: async () => {
          await shell.openExternal('https://github.com/jetyu/NoteWizard/issues');
        }
      },
      { type: 'separator' },
      {
        label: $t('menu.help.about'),
        click: () => mainWindow.webContents.send('menu:open-about')
      }
    ]
  };
}

/**
 * Setup or rebuild the application menu.
 * @param {Electron.BrowserWindow} mainWindow 
 * @param {string} [locale] - Optional new locale to switch to.
 */
export function setupAppMenu(mainWindow, locale) {
  if (locale) {
    i18n.loadTranslations(locale);
  }

  const template = getMenuTemplate(mainWindow);
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
