import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMainWindow } from './windows/mainWindow.js';
import { registerIpcHandlers } from './ipc/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

app.whenReady().then(() => {
  const mainWindow = createMainWindow({ isDev, appPath: path.resolve(__dirname, '../..') });
  registerIpcHandlers(mainWindow);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const window = createMainWindow({ isDev, appPath: path.resolve(__dirname, '../..') });
      registerIpcHandlers(window);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
