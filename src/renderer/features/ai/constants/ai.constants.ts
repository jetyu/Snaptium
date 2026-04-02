/**
 * AI功能相关的常量配置
 */

/**
 * AI助手默认配置
 */
export const AI_ASSISTANT_DEFAULTS = {
  /** 输入延迟（毫秒） - 用户停止输入后多久触发补全 */
  TYPING_DELAY: 2000,
  
  /** 最小输入长度（字符） - 触发补全所需的最小字符数 */
  MIN_INPUT_LENGTH: 10,
  
  /** 上下文长度（字符） - 发送给AI的上下文字符数 */
  CONTEXT_LENGTH: 500,
  
  /** 请求超时（毫秒） - AI请求的最大等待时间 */
  REQUEST_TIMEOUT: 30000,
  
  /** 连续补全延迟（毫秒） - 接受建议后触发下一次补全的延迟 */
  CONTINUOUS_COMPLETION_DELAY: 300,
  
  /** 最大上下文长度（字符） - 防止发送过长的上下文 */
  MAX_CONTEXT_LENGTH: 10000,
} as const;

/**
 * AI API配置
 */
export const AI_API_CONFIG = {
  /** 默认最大token数 */
  MAX_TOKENS: 100,
  
  /** 默认温度参数 */
  TEMPERATURE: 0.7,
  
  /** 是否使用流式输出 */
  STREAM: false,
} as const;

/**
 * AI功能特性标识
 */
export const AI_FEATURES = {
  /** 写作助手 */
  WRITING_ASSISTANT: 'writing-assistant',
  
  /** AI聊天（未来） */
  CHAT: 'chat',
  
  /** AI摘要（未来） */
  SUMMARY: 'summary',
  
  /** AI翻译（未来） */
  TRANSLATION: 'translation',
} as const;

/**
 * AI错误消息
 */
export const AI_ERROR_MESSAGES = {
  DISABLED: 'AI Assistant is disabled',
  NO_SOURCE: 'No AI source selected',
  NO_MODEL: 'No model configured',
  INVALID_CONTEXT: 'Invalid context',
  CONTEXT_TOO_LONG: 'Context too long',
  REQUEST_TIMEOUT: 'Request timeout',
  NETWORK_ERROR: 'Network error',
  EMPTY_RESPONSE: 'Empty completion response',
} as const;
