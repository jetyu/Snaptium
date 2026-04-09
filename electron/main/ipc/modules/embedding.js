import { ipcMain } from 'electron';
import { z } from 'zod';
import { generateEmbeddings, generateEmbeddingSingle, generateEmbeddingsBatch } from '../../services/embedding.service.js';
import { IPC_CHANNELS } from '../../constants/ipc.constants.js';
import { loggerService } from '../../services/logger.service.js';

const logger = loggerService.createLogger('Main:Embedding IPC');

const EmbeddingConfigSchema = z.object({
  endpoint: z.string().url(),
  apiKey: z.string().min(1),
  model: z.string().min(1),
});

const EmbedRequestSchema = z.object({
  texts: z.array(z.string()),
  config: EmbeddingConfigSchema,
});

const EmbedSingleRequestSchema = z.object({
  text: z.string(),
  config: EmbeddingConfigSchema,
});

export function registerEmbeddingHandlers() {
  ipcMain.handle(IPC_CHANNELS.EMBEDDING_GENERATE, async (event, request) => {
    try {
      const validated = EmbedRequestSchema.parse(request);
      return await generateEmbeddings(validated.texts, validated.config);
    } catch (error) {
      logger.error(`EMBEDDING_GENERATE error: ${error.message}`);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.EMBEDDING_GENERATE_SINGLE, async (event, request) => {
    try {
      const validated = EmbedSingleRequestSchema.parse(request);
      return await generateEmbeddingSingle(validated.text, validated.config);
    } catch (error) {
      logger.error(`EMBEDDING_GENERATE_SINGLE error: ${error.message}`);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.EMBEDDING_GENERATE_BATCH, async (event, request) => {
    try {
      const validated = EmbedRequestSchema.parse(request);
      return await generateEmbeddingsBatch(validated.texts, validated.config);
    } catch (error) {
      logger.error(`EMBEDDING_GENERATE_BATCH error: ${error.message}`);
      throw error;
    }
  });
}
