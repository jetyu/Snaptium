import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../constants/ipc.constants.js';
import { settingsService } from '../../services/settings.service.js';
import { $t } from '../../utils/i18n.js';

let cachedConfig = null;
let configLoadTime = 0;
const CONFIG_CACHE_TTL = 5000; // 5秒缓存

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
      const model = aiAssistant.model || source.model;
      if (!model) {
        return { success: false, message: 'No model configured' };
      }

      // 准备消息
      const messages = [];
      
      // 系统提示词：优先使用自定义，否则使用国际化的默认值
      const systemPrompt = aiAssistant.systemPrompt?.trim() || $t('defaultAISystemPrompt');
      messages.push({ role: 'system', content: systemPrompt });

      // 用户消息：直接使用上下文
      messages.push({ role: 'user', content: context });

      // 调用AI API
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时

      try {
        const response = await fetch(source.endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${source.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://github.com/jetyu/NoteWizard',
            'X-Title': 'NoteWizard',
          },
          body: JSON.stringify({
            model,
            messages,
            max_tokens: 100,
            temperature: 0.7,
            stream: false,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          const errorMsg = errorData?.error?.message || `HTTP ${response.status}`;
          console.error('[AI Assistant] API error:', errorMsg);
          return { success: false, message: errorMsg };
        }

        const data = await response.json();
        const completion = data.choices?.[0]?.message?.content?.trim();

        if (!completion) {
          return { success: false, message: 'Empty completion response' };
        }

        console.log('[AI Assistant] Completion successful');
        return { success: true, completion };

      } catch (fetchError) {
        clearTimeout(timeoutId);
        
        if (fetchError.name === 'AbortError') {
          return { success: false, message: 'Request timeout' };
        }
        
        throw fetchError;
      }

    } catch (error) {
      console.error('[AI Assistant IPC] Error:', error);
      return { 
        success: false, 
        message: error.message || 'Unknown error occurred' 
      };
    }
  });
}
