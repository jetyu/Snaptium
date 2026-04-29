import { ipcMain } from 'electron';
import { z } from 'zod';
import { remoteAiService } from '../../services/remote-ai.service.js';
import { aiConfigService } from '../../services/ai-config.service.js';
import { IPC_CHANNELS } from '../../constants/ipc.constants.js';
import { loggerService } from '../../services/logger.service.js';
import { getErrorMessage } from '../../utils/error.utils.js';

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

type AiChatGeneratePayload = z.infer<typeof AiChatGenerateSchema>;
type AiCompletionPayload = z.infer<typeof AiCompletionSchema>;
type AiChatMessage = AiChatGeneratePayload['messages'][number];

interface GenerateAIResponseConfig {
  endpoint: string;
  apiKey: string;
  model: string;
  messages: AiChatMessage[];
}

async function generateAIResponse(config: GenerateAIResponseConfig): Promise<string | undefined> {
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
    logger.debug('Generated AI response', {
      hasChoices: Array.isArray(data?.choices),
      choiceCount: Array.isArray(data?.choices) ? data.choices.length : 0,
    });
    const answer = data.choices?.[0]?.message?.content;
    return answer;
  } catch (error) {
    logger.error('Failed to generate AI response', { error: getErrorMessage(error) });
    throw error;
  }
}

export function registerAIChatHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.AI_CHAT_GENERATE, async (_event, payload: unknown) => {
    try {
      const validatedPayload: AiChatGeneratePayload = AiChatGenerateSchema.parse(payload);
      const assistantConfig = await aiConfigService.resolveAssistantConfig();
      const answer = await generateAIResponse({
        endpoint: assistantConfig.endpoint,
        apiKey: assistantConfig.apiKey,
        model: assistantConfig.model,
        messages: validatedPayload.messages,
      });
      logger.debug('Generated AI response delivered', {
        hasAnswer: Boolean(answer),
        answerLength: answer?.length ?? 0,
      });
      return { success: true, answer };
    } catch (error) {
      const message = getErrorMessage(error);
      logger.error('IPC ai-chat:generate failed', { error: message });
      return { success: false, error: message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.AI_CHAT_GENERATE_COMPLETION, async (_event, payload: unknown) => {
    try {
      const validatedPayload: AiCompletionPayload = AiCompletionSchema.parse(payload);
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
      const message = getErrorMessage(error);
      logger.error('IPC ai-chat:generate-completion failed', { error: message });
      return { success: false, error: message };
    }
  });
}

