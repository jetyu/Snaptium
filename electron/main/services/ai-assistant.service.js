import { settingsService } from './settings.service.js';
import { remoteAiService } from './remote-ai.service.js';
import { loggerService } from './logger.service.js';
import { $t } from '../utils/i18n.js';

const logger = loggerService.createLogger('Electron:AI Assistant Service');

const CONFIG_CACHE_TTL = 5000;
let cachedConfig = null;
let configLoadTime = 0;

async function getConfig() {
  const now = Date.now();
  if (cachedConfig && (now - configLoadTime) < CONFIG_CACHE_TTL) {
    return cachedConfig;
  }
  cachedConfig = await settingsService.loadConfig();
  configLoadTime = now;
  return cachedConfig;
}

export function clearConfigCache() {
  cachedConfig = null;
}

/**
 * Run AI writing-assist completion for the given context text.
 * Validates configuration, builds the prompt, calls the remote AI,
 * and returns a normalised result object.
 *
 * @param {string} context - The editor text passed as user message.
 * @returns {Promise<{success: boolean, completion?: string, message?: string}>}
 */
export async function complete(context) {
  const config = await getConfig();
  const { aiAssistant, aiSources } = config;

  if (!aiAssistant?.enabled) {
    return { success: false, message: $t('aiAssistant.error.disabled') };
  }

  if (!aiAssistant.sourceId) {
    return { success: false, message: $t('aiAssistant.error.noSourceSelected') };
  }

  const source = aiSources?.find(s => s.id === aiAssistant.sourceId);
  if (!source) {
    return { success: false, message: $t('aiAssistant.error.sourceNotFound') };
  }

  const model = aiAssistant.model || source.aiModel;
  if (!model) {
    return { success: false, message: $t('aiAssistant.error.noModelConfigured') };
  }

  const systemPrompt = aiAssistant.systemPrompt?.trim() || $t('ai.prompt.autoComplete');
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: context },
  ];

  try {
    const data = await remoteAiService.chat({
      endpoint: source.endpoint,
      apiKey: source.apiKey,
      model,
      messages,
      max_tokens: 512,
      temperature: 0.7,
    });

    const completion = data.choices?.[0]?.message?.content?.trim();

    if (!completion) {
      return { success: false, message: $t('aiAssistant.error.emptyResponse') };
    }

    logger.debug('Completion successful');
    return { success: true, completion };
  } catch (error) {
    logger.error(`API error: ${error instanceof Error ? error.message : String(error)}`);
    return { success: false, message: error.message };
  }
}

export const aiAssistantService = { complete, clearConfigCache };
