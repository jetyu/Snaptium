import { ipcMain } from 'electron';
import { z } from 'zod';
import { IPC_CHANNELS } from '../../constants/ipc.constants.js';
import { remoteAiService } from '../../services/remote-ai.service.js';
import { loggerService } from '../../services/logger.service.js';

const logger = loggerService.createLogger('Electron:AI Source IPC');

const TestConnectionSchema = z.object({
  aiEndpoint: z.string().url(),
  aiApiKey: z.string().min(1),
  aiModel: z.string().min(1),
});

/**
 * Register AI Source IPC handlers
 */
export function registerAiSourceIpcHandlers() {
  /**
   * Handle testing the connection to a specific AI source
   */
  ipcMain.handle(IPC_CHANNELS.AI_SOURCE_TEST_CONNECTION, async (_event, config) => {
    try {
      const validated = TestConnectionSchema.parse(config);
      logger.debug('Testing connection to AI source');
      return await remoteAiService.testConnection(validated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { success: false, message: `Validation error: ${error.message}` };
      }
      logger.error(`Connection test error: ${error instanceof Error ? error.message : String(error)}`);
      return { success: false, message: error instanceof Error ? error.message : String(error) };
    }
  });
}

