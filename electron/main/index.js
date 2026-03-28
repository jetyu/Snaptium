import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMainWindow } from './windows/mainWindow.js';
import { registerIpcHandlers } from './ipc/index.js';
import { setupAppMenu } from './menu.js';
import { ipcMain } from 'electron';
import { settingsService } from './services/settings.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

app.whenReady().then(async () => {
  const preferences = await settingsService.loadConfig();
  const mainWindow = createMainWindow({ isDev, appPath: path.resolve(__dirname, '../..') });
  registerIpcHandlers(mainWindow);
  setupAppMenu(mainWindow, preferences.language);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void settingsService.loadConfig().then((nextPreferences) => {
        const window = createMainWindow({ isDev, appPath: path.resolve(__dirname, '../..') });
        registerIpcHandlers(window);
        setupAppMenu(window, nextPreferences.language);
      });
    }
  });

  ipcMain.on('app:switch-language', (_event, locale) => {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      setupAppMenu(windows[0], locale);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
