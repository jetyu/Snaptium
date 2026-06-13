import { ipcMain } from 'electron';
import { z } from 'zod';
import { updaterService } from '../../services/updater.service.js';
import { IPC_CHANNELS } from '../../constants/ipc.constants.js';
import { loggerService } from '../../services/logger.service.js';

const logger = loggerService.createLogger('Electron:Updater IPC');
const updaterConfigSchema = z.object({
  autoCheckUpdates: z.boolean(),
  updateCheckInterval: z.number().int().min(60 * 60 * 1000),
  updateChannel: z.enum(['stable', 'beta', 'dev']),
});

export function registerUpdaterHandlers() {
  ipcMain.handle(IPC_CHANNELS.UPDATER_CHECK, async (_event, silent = false) => {
    logger.debug('Checking for updates...');
    await updaterService.checkForUpdates(silent);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.UPDATER_DOWNLOAD, async () => {
    logger.debug('Downloading update...');
    await updaterService.downloadUpdate();
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.UPDATER_USER_CANCEL_DOWNLOAD, async () => {
    logger.debug('Cancelling update download...');
    updaterService.cancelDownload();
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.UPDATER_INSTALL, () => {
    logger.debug('Installing update...');
    updaterService.quitAndInstall();
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.UPDATER_GET_VERSION, () => {
    logger.debug('Getting current version...');
    return updaterService.getCurrentVersion();
  });

  ipcMain.handle(IPC_CHANNELS.UPDATER_UPDATE_CONFIG, async (_event, rawConfig: unknown) => {
    logger.debug('Updating config...');
    await updaterService.updateConfig(updaterConfigSchema.parse(rawConfig));
    return { success: true };
  });
}
