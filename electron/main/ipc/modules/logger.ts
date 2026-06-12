import { ipcMain } from 'electron';
import { loggerService } from '../../services/logger.service.js';
import { IPC_CHANNELS } from '../../constants/ipc.constants.js';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | { [key: string]: JsonValue } | JsonValue[];

interface LoggerLogPayload {
  level: string;
  source: string;
  message: string;
  context?: JsonValue;
}

export function registerLoggerIpcHandlers() {
  ipcMain.on(IPC_CHANNELS.LOGGER_LOG, (_event, payload: LoggerLogPayload) => {
    const { level, source, message, context } = payload;
    loggerService.log(level, source, message, context);
  });

  ipcMain.handle(IPC_CHANNELS.LOGGER_OPEN_DIR, () => {
    loggerService.openLogDir();
  });
}
