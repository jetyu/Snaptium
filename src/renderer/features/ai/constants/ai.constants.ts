/**
 * AI功能相关的常量配置
 */

import {
  AI_WRITING_SCENARIO,
  AI_WRITING_STYLE,
  AI_WRITING_MODE,
} from '@shared/ai.constants';

export type { AiWritingScenario, AiWritingStyle, AiWritingMode } from '@shared/ai.constants';

export const AI_WRITING_MODE_OPTIONS = [
  {
    value: AI_WRITING_MODE.FOCUS,
    labelKey: 'option.aiWritingMode.focus',
  },
  {
    value: AI_WRITING_MODE.STANDARD,
    labelKey: 'option.aiWritingMode.standard',
  },
  {
    value: AI_WRITING_MODE.AGGRESSIVE,
    labelKey: 'option.aiWritingMode.aggressive',
  },
] as const;

export const AI_WRITING_MODE_CONFIG = {
  [AI_WRITING_MODE.FOCUS]: { delay: 3000, cooldown: 10000 },
  [AI_WRITING_MODE.STANDARD]: { delay: 1500, cooldown: 3000 },
  [AI_WRITING_MODE.AGGRESSIVE]: { delay: 800, cooldown: 1500 },
} as const;

export const AI_WRITING_STYLE_OPTIONS = [
  {
    value: AI_WRITING_STYLE.CONCISE,
    labelKey: 'option.aiWritingStyle.concise',
    summaryKey: 'text.aiWritingStylePrompt.concise',
  },
  {
    value: AI_WRITING_STYLE.RIGOROUS,
    labelKey: 'option.aiWritingStyle.rigorous',
    summaryKey: 'text.aiWritingStylePrompt.rigorous',
  },
  {
    value: AI_WRITING_STYLE.PROFESSIONAL,
    labelKey: 'option.aiWritingStyle.professional',
    summaryKey: 'text.aiWritingStylePrompt.professional',
  },
  {
    value: AI_WRITING_STYLE.ACCESSIBLE,
    labelKey: 'option.aiWritingStyle.accessible',
    summaryKey: 'text.aiWritingStylePrompt.accessible',
  },
  {
    value: AI_WRITING_STYLE.VIVID,
    labelKey: 'option.aiWritingStyle.vivid',
    summaryKey: 'text.aiWritingStylePrompt.vivid',
  },
] as const;

export const AI_WRITING_SCENARIO_OPTIONS = [
  {
    value: AI_WRITING_SCENARIO.GENERAL,
    labelKey: 'option.aiWritingScenario.general',
  },
  {
    value: AI_WRITING_SCENARIO.TECHNICAL_DOCUMENT,
    labelKey: 'option.aiWritingScenario.technicalDocument',
  },
  {
    value: AI_WRITING_SCENARIO.PRODUCT_DOCUMENT,
    labelKey: 'option.aiWritingScenario.productDocument',
  },
  {
    value: AI_WRITING_SCENARIO.SUMMARY_REPORT,
    labelKey: 'option.aiWritingScenario.summaryReport',
  },
  {
    value: AI_WRITING_SCENARIO.DAILY_RECORD,
    labelKey: 'option.aiWritingScenario.dailyRecord',
  },
  {
    value: AI_WRITING_SCENARIO.CONTENT_CREATION,
    labelKey: 'option.aiWritingScenario.contentCreation',
  },
  {
    value: AI_WRITING_SCENARIO.OFFICIAL_WRITING,
    labelKey: 'option.aiWritingScenario.officialWriting',
  },
] as const;

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
  
  /** AI聊天 */
  CHAT: 'chat',
  
  /** AI摘要 */
  SUMMARY: 'summary',
  
  /** AI翻译 */
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
