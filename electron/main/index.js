import { app, BrowserWindow,ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMainWindow } from './windows/mainWindow.js';
import { registerIpcHandlers } from './ipc/index.js';
import { setupAppMenu } from './menu.js';
import { settingsService } from './services/settings.service.js';
import { loggerService } from './services/logger.service.js';
import { trayService } from './services/tray.service.js';
import { updaterService } from './services/updater.service.js';
import { IPC_CHANNELS } from './constants/ipc.constants.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

app.whenReady().then(async () => {
  const preferences = await settingsService.loadConfig();
  loggerService.updateConfig(preferences);
  const mainWindow = createMainWindow({ isDev, appPath: path.resolve(__dirname, '../..') });
  registerIpcHandlers(mainWindow);
  setupAppMenu(mainWindow, preferences.language);
  
  trayService.init(mainWindow);
  
  if (!isDev) {
    await updaterService.initialize(mainWindow);
  }

  mainWindow.on(IPC_CHANNELS.ELECTRON_CLOSE, (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  app.on(IPC_CHANNELS.ELECTRON_ACTIVATE, () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void settingsService.loadConfig().then((nextPreferences) => {
        const window = createMainWindow({ isDev, appPath: path.resolve(__dirname, '../..') });
        registerIpcHandlers(window);
        setupAppMenu(window, nextPreferences.language);
        trayService.init(window);
      });
    }
  });

  ipcMain.on(IPC_CHANNELS.SETTINGS_SWITCH_LANGUAGE, (_event, locale) => {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      setupAppMenu(windows[0], locale);
      trayService.updateLanguage();
    }
  });
});

app.on(IPC_CHANNELS.ELECTRON_WIN_ALL_CLOSED, () => {
  if (process.platform !== IPC_CHANNELS.PLATFORM_DARWIN_KERNEL) {
    app.isQuitting = true;
    app.quit();
  }
});

app.on(IPC_CHANNELS.ELECTRON_BEFORE_QUIT, () => {
  app.isQuitting = true;
  trayService.destroy();
  updaterService.destroy();
});
