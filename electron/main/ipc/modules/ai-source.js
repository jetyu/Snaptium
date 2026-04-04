import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../constants/ipc.constants.js';
import { remoteAiService } from '../../services/remote-ai.service.js';
import { loggerService } from '../../services/logger.service.js';

const logger = loggerService.createLogger('Electron:AI Source IPC');

/**
 * Register AI Source IPC handlers
 */
export function registerAiSourceIpcHandlers() {
  /**
   * Handle testing the connection to a specific AI source
   */
  ipcMain.handle(IPC_CHANNELS.AI_SOURCE_TEST_CONNECTION, async (_event, config) => {
    logger.debug('Testing connection to AI source');
    return await remoteAiService.testConnection(config);
  });
}

