import { ipcMain, type BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../constants/ipc.constants.js';

function emitWindowState(mainWindow: BrowserWindow): void {
  if (mainWindow.isDestroyed()) {
    return;
  }
  mainWindow.webContents.send(IPC_CHANNELS.WINDOW_STATE_CHANGED, {
    isMaximized: mainWindow.isMaximized(),
  });
}

export function registerWindowIpcHandlers(mainWindow: BrowserWindow): void {
  ipcMain.handle(IPC_CHANNELS.WINDOW_MINIMIZE, () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.minimize();
    }
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_MAXIMIZE, () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.maximize();
      emitWindowState(mainWindow);
    }
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_UNMAXIMIZE, () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.unmaximize();
      emitWindowState(mainWindow);
    }
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_CLOSE, () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.close();
    }
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_IS_MAXIMIZED, () => {
    if (mainWindow.isDestroyed()) {
      return false;
    }
    return mainWindow.isMaximized();
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_RELOAD, () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.reload();
    }
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_FORCE_RELOAD, () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.reloadIgnoringCache();
    }
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_TOGGLE_DEVTOOLS, () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.toggleDevTools();
    }
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_RESET_ZOOM, () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.setZoomLevel(0);
    }
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_ZOOM_IN, () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.setZoomLevel(mainWindow.webContents.getZoomLevel() + 1);
    }
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_ZOOM_OUT, () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.setZoomLevel(mainWindow.webContents.getZoomLevel() - 1);
    }
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_TOGGLE_FULLSCREEN, () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
      emitWindowState(mainWindow);
    }
  });

  const syncState = () => emitWindowState(mainWindow);
  mainWindow.on('maximize', syncState);
  mainWindow.on('unmaximize', syncState);
  mainWindow.on('enter-full-screen', syncState);
  mainWindow.on('leave-full-screen', syncState);
}

