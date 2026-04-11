import { ipcMain } from 'electron';
import { z } from 'zod';
import { remoteAiService } from '../../services/remote-ai.service.js';
import { aiConfigService } from '../../services/ai-config.service.js';
import { IPC_CHANNELS } from '../../constants/ipc.constants.js';
import { loggerService } from '../../services/logger.service.js';

const logger = loggerService.createLogger('Electron:AI Chat IPC');

const AiChatGenerateSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string(),
  })),
});

const AiCompletionSchema = z.object({
  context: z.string().min(1),
  systemPrompt: z.string().optional(),
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
  ipcMain.handle(IPC_CHANNELS.AI_CHAT_GENERATE, async (_event, payload) => {
    try {
      const validatedPayload = AiChatGenerateSchema.parse(payload);
      const assistantConfig = await aiConfigService.resolveAssistantConfig();
      const answer = await generateAIResponse({
        endpoint: assistantConfig.endpoint,
        apiKey: assistantConfig.apiKey,
        model: assistantConfig.model,
        messages: validatedPayload.messages,
      });
      logger.debug('Generated AI response', { answer });
      return { success: true, answer };
    } catch (error) {
      logger.error('IPC ai-chat:generate failed', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.AI_CHAT_GENERATE_COMPLETION, async (_event, payload) => {
    try {
      const validatedPayload = AiCompletionSchema.parse(payload);
      const assistantConfig = await aiConfigService.resolveAssistantConfig();
      const systemPrompt = validatedPayload.systemPrompt?.trim() || assistantConfig.systemPrompt;
      const answer = await generateAIResponse({
        endpoint: assistantConfig.endpoint,
        apiKey: assistantConfig.apiKey,
        model: assistantConfig.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: validatedPayload.context },
        ],
      });

      logger.debug('Generated completion response', { hasAnswer: Boolean(answer) });
      return { success: true, answer };
    } catch (error) {
      logger.error('IPC ai-chat:generate-completion failed', { error: error.message });
      return { success: false, error: error.message };
    }
  });
}

