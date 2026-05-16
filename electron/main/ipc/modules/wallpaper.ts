import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../constants/ipc.constants.js';
import { wallpaperService, type WallpaperRequestOptions } from '../../services/wallpaper.service.js';
import { loggerService } from '../../services/logger.service.js';

const logger = loggerService.createLogger('Electron:Wallpaper IPC');

function shouldSwitchSource(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  return (payload as Record<string, unknown>).switchSource === true;
}

function getCurrentSource(payload: unknown): WallpaperRequestOptions['currentSource'] {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const currentSource = (payload as Record<string, unknown>).currentSource;
  if (
    currentSource === 'bing'
    || currentSource === 'picsum'
    || currentSource === 'cache'
    || currentSource === 'fallback'
  ) {
    return currentSource;
  }

  return undefined;
}

export function registerWallpaperIpcHandlers(): void {
  ipcMain.removeHandler(IPC_CHANNELS.APP_GET_WALLPAPER);
  ipcMain.handle(IPC_CHANNELS.APP_GET_WALLPAPER, async (_event, payload: unknown) => {
    logger.debug('Getting wallpaper');
    return wallpaperService.getDailyWallpaper({
      switchSource: shouldSwitchSource(payload),
      currentSource: getCurrentSource(payload),
    });
  });
}
