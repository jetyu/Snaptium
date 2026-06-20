import { loggerService } from '../services/logger.service.js';

export type PromptTemplateLanguage = 'zh-CN' | 'en-US';

export interface PromptLanguageContext {
  uiLanguage: string;
  inputLanguage: PromptTemplateLanguage | null;
  fallbackLanguage: PromptTemplateLanguage;
}

const logger = loggerService.createLogger('Electron:Prompt Language');

const PROMPT_TEMPLATE_LANGUAGES = new Set<PromptTemplateLanguage>(['zh-CN', 'en-US']);

export interface ResolvedPromptLanguage {
  uiLanguage: string;
  inputLanguage: PromptTemplateLanguage | null;
  effectiveLanguage: PromptTemplateLanguage;
  fallbackLanguage: PromptTemplateLanguage;
}

function countMatches(text: string, pattern: RegExp): number {
  return (text.match(pattern) ?? []).length;
}

export function detectPromptInputLanguage(text: string): PromptTemplateLanguage | null {
  const normalized = text.trim();
  if (normalized.length < 2) {
    return null;
  }

  const cjkCount = countMatches(normalized, /[\u3400-\u9fff]/g);
  const latinCount = countMatches(normalized, /[A-Za-z]/g);
  const digitCount = countMatches(normalized, /[0-9]/g);

  if (cjkCount >= Math.max(2, latinCount)) {
    return 'zh-CN';
  }

  if (latinCount >= Math.max(3, cjkCount * 2) && latinCount > digitCount) {
    return 'en-US';
  }

  return null;
}

function normalizeUiLanguage(value: string): string {
  const normalized = value.trim();
  return normalized || 'en-US';
}

function mapUiLanguageToPromptTemplateLanguage(uiLanguage: string): PromptTemplateLanguage {
  const normalizedUiLanguage = normalizeUiLanguage(uiLanguage);
  if (PROMPT_TEMPLATE_LANGUAGES.has(normalizedUiLanguage as PromptTemplateLanguage)) {
    return normalizedUiLanguage as PromptTemplateLanguage;
  }

  return normalizedUiLanguage.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US';
}

export function resolvePromptLanguage(uiLanguage: string, inputText: string): ResolvedPromptLanguage {
  const resolvedUiLanguage = normalizeUiLanguage(uiLanguage);
  const inputLanguage = detectPromptInputLanguage(inputText);
  const effectiveLanguage = inputLanguage ?? mapUiLanguageToPromptTemplateLanguage(resolvedUiLanguage);

  logger.debug('Resolved prompt language', {
    uiLanguage: resolvedUiLanguage,
    inputLanguage: inputLanguage ?? 'unknown',
    effectiveLanguage,
  });

  return {
    uiLanguage: resolvedUiLanguage,
    inputLanguage,
    effectiveLanguage,
    fallbackLanguage: 'en-US',
  };
}
