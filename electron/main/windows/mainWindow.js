import { BrowserWindow } from 'electron';
import path from 'node:path';

export function createMainWindow({ isDev, appPath }) {
  const mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 960,
    minHeight: 680,
    show: false,
    title: 'NoteWizard',
    webPreferences: {
      preload: path.join(appPath, 'electron/preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(appPath, 'dist/renderer/index.html'));
  }

  return mainWindow;
}
