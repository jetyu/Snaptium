import { ipcMain } from 'electron';
import { z } from 'zod';
import { IPC_CHANNELS } from '../../constants/ipc.constants.js';
import {
  createProviderChatModel,
  createProviderEmbeddings,
  createProviderReranker,
} from '../../services/ai-provider.service.js';
import { AI_PROVIDERS } from '../../../shared/ai-provider.constants.js';
import { Document } from '@langchain/core/documents';
import { loggerService } from '../../services/logger.service.js';
import { getErrorMessage } from '../../services/error.service.js';
import { LICENSE_RUNTIME_FEATURES, licenseService } from '../../services/license.service.js';

const logger = loggerService.createLogger('Electron:AI Source IPC');

const TestConnectionSchema = z.object({
  provider: z.enum(AI_PROVIDERS),
  aiBaseUrl: z.string().url(),
  aiApiKey: z.string(),
  aiModel: z.string().min(1),
  capabilities: z.array(z.enum(['chat', 'embedding', 'reranker'])).default(['chat']),
});

const ValidateToolCallingSchema = z.object({
  provider: z.enum(AI_PROVIDERS),
  baseUrl: z.string().url(),
  apiKey: z.string(),
  model: z.string().min(1),
});

async function testProviderCapability(
  validated: z.infer<typeof TestConnectionSchema>,
  capability: 'chat' | 'embedding' | 'reranker',
): Promise<void> {
  const config = {
    provider: validated.provider,
    baseUrl: validated.aiBaseUrl,
    apiKey: validated.aiApiKey,
    model: validated.aiModel,
  };
  if (capability === 'chat') {
    await createProviderChatModel(config).invoke('Reply with OK.');
    return;
  }
  if (capability === 'embedding') {
    await createProviderEmbeddings(config).embedQuery('connection test');
    return;
  }
  await createProviderReranker(config).compressDocuments([
    new Document({ pageContent: 'connection test' }),
  ], 'connection test');
}

/**
 * Register AI Source IPC handlers
 */
export function registerAiSourceIpcHandlers() {
  /**
   * Handle testing the connection to a specific AI source
   */
  ipcMain.handle(IPC_CHANNELS.AI_SOURCE_TEST_CONNECTION, async (_event, config) => {
    try {
      licenseService.ensureFeatureEnabled(LICENSE_RUNTIME_FEATURES.AI_SOURCES);
      const validated = TestConnectionSchema.parse(config);
      logger.debug('Testing connection to AI source');
      let lastError: unknown = null;
      for (const capability of validated.capabilities) {
        try {
          await testProviderCapability(validated, capability);
          return { success: true };
        } catch (error) {
          lastError = error;
        }
      }
      return { success: false, message: getErrorMessage(lastError) };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { success: false, message: `Validation error: ${error.message}` };
      }
      const message = getErrorMessage(error);
      logger.error(`Connection test error: ${message}`);
      return { success: false, message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.AI_SOURCE_VALIDATE_TOOL_CALLING, async (_event, payload) => {
    try {
      licenseService.ensureFeatureEnabled(LICENSE_RUNTIME_FEATURES.AI_SOURCES);
      const validated = ValidateToolCallingSchema.parse(payload);
      const model = createProviderChatModel({
        provider: validated.provider,
        baseUrl: validated.baseUrl,
        apiKey: validated.apiKey,
        model: validated.model,
      });
      if (!model.bindTools) {
        throw new Error('Selected model does not expose Tool Calling');
      }
      const withTools = model.bindTools([{
        name: 'snaptium_capability_probe',
        description: 'Return a test value.',
        schema: z.object({ value: z.string() }),
      }]);
      await withTools.invoke('Call snaptium_capability_probe with value "ok".');
      return { success: true };
    } catch (error) {
      return { success: false, message: getErrorMessage(error) };
    }
  });
}
