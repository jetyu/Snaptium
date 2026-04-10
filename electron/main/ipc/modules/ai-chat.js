import { ipcMain } from 'electron';
import { z } from 'zod';
import { remoteAiService } from '../../services/remote-ai.service.js';
import { loggerService } from '../../services/logger.service.js';

const logger = loggerService.createLogger('Electron:AI Chat IPC');

const AiChatGenerateSchema = z.object({
  endpoint: z.string().url(),
  apiKey: z.string().min(1),
  model: z.string().min(1),
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string(),
  })),
});

async function generateAIResponse(config) {
  const { endpoint, apiKey, model, messages } = config;

  try {
    const data = await remoteAiService.chat({
      endpoint,
      apiKey,
      model,
      messages,
      temperature: 0.7,
      max_tokens: 1000,
    });
    logger.debug('Generated AI response', { data });
    const answer = data.choices?.[0]?.message?.content;
    return answer;
  } catch (error) {
    logger.error('Failed to generate AI response', { error: error.message });
    throw error;
  }
}

export function registerAIChatHandlers() {
  ipcMain.handle('ai-chat:generate', async (event, config) => {
    try {
      const validatedConfig = AiChatGenerateSchema.parse(config);
      const answer = await generateAIResponse(validatedConfig);
      logger.debug('Generated AI response', { answer });
      return { success: true, answer };
    } catch (error) {
      logger.error('IPC ai-chat:generate failed', { error: error.message });
      return { success: false, error: error.message };
    }
  });
}

