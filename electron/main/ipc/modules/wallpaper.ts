import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../constants/ipc.constants.js';
import { wallpaperService, type WallpaperRequestOptions } from '../../services/wallpaper.service.js';
import { loggerService } from '../../services/logger.service.js';

const logger = loggerService.createLogger('Electron:Wallpaper IPC');

function shouldLoadNextArchive(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  return (payload as Record<string, unknown>).nextArchive === true;
}

function getCurrentArchiveIndex(payload: unknown): WallpaperRequestOptions['currentArchiveIndex'] {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const currentArchiveIndex = (payload as Record<string, unknown>).currentArchiveIndex;
  return typeof currentArchiveIndex === 'number' ? currentArchiveIndex : undefined;
}

export function registerWallpaperIpcHandlers(): void {
  ipcMain.removeHandler(IPC_CHANNELS.APP_GET_WALLPAPER);
  ipcMain.handle(IPC_CHANNELS.APP_GET_WALLPAPER, async (_event, payload: unknown) => {
    logger.debug('Getting wallpaper');
    return wallpaperService.getDailyWallpaper({
      nextArchive: shouldLoadNextArchive(payload),
      currentArchiveIndex: getCurrentArchiveIndex(payload),
    });
  });
}
