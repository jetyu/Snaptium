import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../constants/ipc.constants.js';
import { appEnvInfoService } from '../../services/appEnvInfo.service.js';
import { loggerService } from '../../services/logger.service.js';

const logger = loggerService.createLogger('Electron:App Env Info IPC');

export function registerAppEnvInfoIpcHandlers() {
  ipcMain.handle(IPC_CHANNELS.APP_GET_VERSION, () => {
    logger.debug('Getting app version...');
    return appEnvInfoService.getAppVersion();
  });
  ipcMain.handle(IPC_CHANNELS.APP_GET_DISTRIBUTION, () => {
    logger.debug('Getting app distribution...');
    return appEnvInfoService.getDistribution();
  });
  ipcMain.handle(IPC_CHANNELS.APP_GET_ENV_VERSION, () => {
    logger.debug('Getting environment version...');
    return appEnvInfoService.getEnvVersion();
  });
  ipcMain.handle(IPC_CHANNELS.APP_GET_NAME, () => {
    logger.debug('Getting app name...');
    return appEnvInfoService.getAppName();
  });
  ipcMain.handle(IPC_CHANNELS.APP_OPEN_STORE_PAGE, async () => {
    logger.debug('Opening Microsoft Store product page...');
    await appEnvInfoService.openStorePage();
  });
}
