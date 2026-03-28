import { ipcMain } from 'electron';
import { loggerService } from '../../services/logger.service.js';
import { IPC_CHANNELS } from '../../constants/channels.constants.js';

export function registerLoggerIpcHandlers() {
  ipcMain.on(IPC_CHANNELS.LOGGER_LOG, (_event, { level, source, message }) => {
    loggerService.log(level, source, message);
  });

  ipcMain.handle(IPC_CHANNELS.LOGGER_OPEN_DIR, () => {
    loggerService.openLogDir();
  });
}
