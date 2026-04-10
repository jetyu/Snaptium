import { ipcMain } from 'electron';
import { z } from 'zod';
import { IPC_CHANNELS } from '../../constants/ipc.constants.js';
import { aiAssistantService } from '../../services/ai-assistant.service.js';
import { loggerService } from '../../services/logger.service.js';

const logger = loggerService.createLogger('Electron:AI Assistant IPC');

const AiAssistantCompleteSchema = z.object({
  context: z.string().min(1).max(10000),
});

export function clearAiAssistantConfigCache() {
  aiAssistantService.clearConfigCache();
}

export function registerAiAssistantIpcHandlers() {
  ipcMain.handle(IPC_CHANNELS.AI_ASSISTANT_COMPLETE, async (_event, payload) => {
    try {
      const { context } = AiAssistantCompleteSchema.parse(payload);
      return await aiAssistantService.complete(context);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { success: false, message: `Validation error: ${error.message}` };
      }
      logger.error(`Unhandled error: ${error instanceof Error ? error.message : String(error)}`);
      return { success: false, message: error.message };
    }
  });
}

