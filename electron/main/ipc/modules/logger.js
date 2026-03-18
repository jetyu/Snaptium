import { ipcMain } from 'electron';
import { loggerService } from '../../services/logger.service.js';

export function registerLoggerIpcHandlers() {
  ipcMain.on('logger:log', (event, { level, source, message }) => {
    loggerService.log(level, source, message);
  });
}
