import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../constants/ipc.constants.js';
import { settingsService } from '../../services/settings.service.js';
import { $t } from '../../utils/i18n.js';
import { remoteAiService } from '../../services/remote-ai.service.js';
import { loggerService } from '../../services/logger.service.js';

let cachedConfig = null;
let configLoadTime = 0;
const CONFIG_CACHE_TTL = 5000; // 5秒缓存
const logger = loggerService.createLogger('Electron:AI Assistant IPC');

/**
 * 获取配置（带缓存）
 */
async function getConfig() {
  const now = Date.now();
  if (cachedConfig && (now - configLoadTime) < CONFIG_CACHE_TTL) {
    return cachedConfig;
  }

  cachedConfig = await settingsService.loadConfig();
  configLoadTime = now;
  return cachedConfig;
}

/**
 * 清除配置缓存（当设置更新时调用）
 */
export function clearAiAssistantConfigCache() {
  cachedConfig = null;
}

/**
 * Register AI Assistant IPC handlers
 */
export function registerAiAssistantIpcHandlers() {
  /**
   * AI completion for writing assistance
   * @param {Object} payload - { context: string }
   */
  ipcMain.handle(IPC_CHANNELS.AI_ASSISTANT_COMPLETE, async (_event, payload) => {
    try {
      const { context } = payload;

      // 验证输入
      if (!context || typeof context !== 'string') {
        return { success: false, message: 'Invalid context' };
      }

      if (context.length > 10000) {
        return { success: false, message: 'Context too long (max 10000 characters)' };
      }

      // 加载配置
      const config = await getConfig();
      const { aiAssistant, aiSources } = config;

      // 验证配置
      if (!aiAssistant?.enabled) {
        return { success: false, message: 'AI Assistant is disabled' };
      }

      if (!aiAssistant.sourceId) {
        return { success: false, message: 'No AI source selected' };
      }

      // 查找AI源
      const source = aiSources?.find(s => s.id === aiAssistant.sourceId);
      if (!source) {
        return { success: false, message: 'AI source not found' };
      }

      // 验证模型
      const model = aiAssistant.model || source.aiModel;
      if (!model) {
        return { success: false, message: 'No model configured' };
      }

      const messages = [];

      const systemPrompt = aiAssistant.systemPrompt?.trim() || $t('ai.prompt.autoComplete');
      messages.push({ role: 'system', content: systemPrompt });
      messages.push({ role: 'user', content: context });

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
          return { success: false, message: 'Empty completion response' };
        }

        logger.debug('Completion successful');
        return { success: true, completion };

      } catch (error) {
        logger.error(`API error: ${error instanceof Error ? error.message : String(error)}`);
        return { success: false, message: error.message };
      }

    } catch (error) {
      logger.error(`Unhandled error: ${error instanceof Error ? error.message : String(error)}`);
      return {
        success: false,
        message: error.message || 'Unknown error occurred'
      };
    }
  });
}

