import { ipcMain } from 'electron';
import { aiService } from '../../services/ai.service.js';
import { IPC_CHANNELS } from '../../constants/channels.constants.js';

/**
 * Register AI Source IPC handlers
 */
export function registerAiSourceIpcHandlers() {
  /**
   * Handle testing the connection to a specific AI source
   */
  ipcMain.handle(IPC_CHANNELS.AI_SOURCE_TEST_CONNECTION, async (_event, config) => {
    return await aiService.testConnection(config);
  });
}
