import { ipcMain } from 'electron';
import { loggerService } from '../../services/logger.service.js';
import { IPC_CHANNELS } from '../../constants/ipc.constants.js';

export function registerLoggerIpcHandlers() {
  ipcMain.on(IPC_CHANNELS.LOGGER_LOG, (_event, { level, source, message, context }) => {
    loggerService.log(level, source, message, context);
  });

  ipcMain.handle(IPC_CHANNELS.LOGGER_OPEN_DIR, () => {
    loggerService.openLogDir();
  });
}
