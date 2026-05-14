import { BrowserWindow, shell, type Event } from 'electron';
import path from 'node:path';
import { $t } from '../utils/i18n.js';

interface CreateMainWindowOptions {
  isDev: boolean;
  appPath: string;
}

export function secureWebContents(win: BrowserWindow, isDev: boolean): void {
  const webContents = win.webContents;

  webContents.setWindowOpenHandler(({ url }: { url: string }) => {
    const allowedDomains = ['https://github.com'];

    if (allowedDomains.some((domain) => url.startsWith(domain))) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  webContents.on('will-navigate', (event: Event, url: string) => {
    const allowedPrefixes = isDev
      ? ['http://127.0.0.1:5173']
      : ['file://'];

    const isAllowed = allowedPrefixes.some((prefix) => url.startsWith(prefix));

    if (!isAllowed) {
      event.preventDefault();
    }
  });
}

export function createMainWindow({ isDev, appPath }: CreateMainWindowOptions): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 960,
    minHeight: 680,
    show: false,
    title: $t('common.appName'),
    icon: path.join(appPath, 'electron/assets/logo/app-logo.ico'),
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(appPath, '.electron-build/electron/preload/index.js'),
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
