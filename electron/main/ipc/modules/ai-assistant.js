import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../constants/ipc.constants.js';

/**
 * Register AI Assistant IPC handlers
 */
export function registerAiAssistantIpcHandlers() {
  /**
   * Placeholder for AI completion (assistant specific)
   */
  ipcMain.handle(IPC_CHANNELS.AI_ASSISTANT_COMPLETE, async (_event, _payload) => {
    return { success: false, message: 'Not implemented yet' };
  });
}
