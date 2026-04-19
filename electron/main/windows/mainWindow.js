import { BrowserWindow, shell } from 'electron';
import path from 'node:path';
import { $t } from '../utils/i18n.js';

export function secureWebContents(win, isDev) {
  const webC = win.webContents;

  webC.setWindowOpenHandler(({ url }) => {
    const allowedDomains = ['https://github.com'];

    if (allowedDomains.some(domain => url.startsWith(domain))) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  webC.on('will-navigate', (e, url) => {
    const allowedPrefixes = isDev
      ? ['http://127.0.0.1:5173']
      : ['file://'];

    const isAllowed = allowedPrefixes.some(prefix => url.startsWith(prefix));

    if (!isAllowed) {
      e.preventDefault();
    }
  });
}

export function createMainWindow({ isDev, appPath }) {
  const mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 960,
    minHeight: 680,
    show: false,
    title: $t('common.appName'),
    icon: path.join(appPath, 'electron/assets/logo/app-logo.ico'),
    webPreferences: {
      preload: path.join(appPath, 'electron/preload/index.js'),
      devTools: isDev,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5173');
  } else {
    mainWindow.loadFile(path.join(appPath, 'dist/renderer/index.html'));
  }

  secureWebContents(mainWindow, isDev);

  return mainWindow;
}