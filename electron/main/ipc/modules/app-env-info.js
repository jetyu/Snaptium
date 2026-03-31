import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../constants/channels.constants.js';
import { appEnvInfoService } from '../../services/appEnvInfo.service.js';

export function registerAppEnvInfoIpcHandlers() {
  ipcMain.handle(IPC_CHANNELS.APP_GET_VERSION, () => {
    return appEnvInfoService.getAppVersion();
  });
  ipcMain.handle(IPC_CHANNELS.APP_GET_ENV_VERSION, () => {
    return appEnvInfoService.getEnvVersion();
  });
  ipcMain.handle(IPC_CHANNELS.APP_GET_NAME, () => {
    return appEnvInfoService.getAppName();
  });
}
