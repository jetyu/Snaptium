import { ipcMain } from 'electron';
import { z } from 'zod';
import { IPC_CHANNELS } from '../../constants/ipc.constants.js';
import { searchService } from '../../services/search.service.js';
import { loggerService } from '../../services/logger.service.js';

const logger = loggerService.createLogger('Main:Search IPC');

const SearchQuerySchema = z.string().min(1);

export function registerSearchIpcHandlers() {
  ipcMain.removeHandler(IPC_CHANNELS.SEARCH_NOTES);

  ipcMain.handle(IPC_CHANNELS.SEARCH_NOTES, async (_event, query) => {
    try {
      const validatedQuery = SearchQuerySchema.parse(query);
      return await searchService.searchNotes(validatedQuery);
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn('Search request validation failed', { error: error.message });
        return [];
      }
      logger.error('Search request failed', { error: error.message, query });
      return [];
    }
  });
}
