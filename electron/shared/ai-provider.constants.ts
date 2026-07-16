import type { AiCapability } from './official-ai.constants.js';

export const AI_PROVIDERS = {
  SNAPTIUM: 'snaptium',
  OPENAI: 'openai',
  OPENAI_COMPATIBLE: 'openai-compatible',
  SILICONFLOW: 'siliconflow',
  GOOGLE_GEMINI: 'google-gemini',
  OLLAMA: 'ollama',
  OPENROUTER: 'openrouter',
  DEEPSEEK: 'deepseek',
} as const satisfies Record<string, string>;

export type AiProvider = (typeof AI_PROVIDERS)[keyof typeof AI_PROVIDERS];

export const AI_PROVIDER_DEFAULT_BASE_URLS = {
  [AI_PROVIDERS.SNAPTIUM]: 'https://api.snaptium.com/v1/ai',
  [AI_PROVIDERS.OPENAI]: 'https://api.openai.com/v1',
  [AI_PROVIDERS.OPENAI_COMPATIBLE]: '',
  [AI_PROVIDERS.SILICONFLOW]: 'https://api.siliconflow.cn/v1',
  [AI_PROVIDERS.GOOGLE_GEMINI]: 'https://generativelanguage.googleapis.com',
  [AI_PROVIDERS.OLLAMA]: 'http://127.0.0.1:11434',
  [AI_PROVIDERS.OPENROUTER]: 'https://openrouter.ai/api/v1',
  [AI_PROVIDERS.DEEPSEEK]: 'https://api.deepseek.com',
} as const satisfies Record<AiProvider, string>;

export const AI_PROVIDER_CAPABILITIES = {
  [AI_PROVIDERS.SNAPTIUM]: ['chat', 'embedding', 'reranker'],
  [AI_PROVIDERS.OPENAI]: ['chat', 'embedding'],
  [AI_PROVIDERS.OPENAI_COMPATIBLE]: ['chat', 'embedding', 'reranker'],
  [AI_PROVIDERS.SILICONFLOW]: ['chat', 'embedding', 'reranker'],
  [AI_PROVIDERS.GOOGLE_GEMINI]: ['chat', 'embedding'],
  [AI_PROVIDERS.OLLAMA]: ['chat', 'embedding'],
  [AI_PROVIDERS.OPENROUTER]: ['chat', 'embedding', 'reranker'],
  [AI_PROVIDERS.DEEPSEEK]: ['chat'],
} as const satisfies Record<AiProvider, readonly AiCapability[]>;

const AI_PROVIDER_SET = new Set<string>(Object.values(AI_PROVIDERS));

export function isAiProvider(value: unknown): value is AiProvider {
  return typeof value === 'string' && AI_PROVIDER_SET.has(value);
}

export function inferAiProvider(baseUrl: string): AiProvider {
  const normalized = baseUrl.trim().toLowerCase();
  if (normalized.includes('api.snaptium.com')) return AI_PROVIDERS.SNAPTIUM;
  if (normalized.includes('api.siliconflow.cn')) return AI_PROVIDERS.SILICONFLOW;
  if (normalized.includes('api.openai.com')) return AI_PROVIDERS.OPENAI;
  if (normalized.includes('generativelanguage.googleapis.com')) return AI_PROVIDERS.GOOGLE_GEMINI;
  if (normalized.includes('openrouter.ai')) return AI_PROVIDERS.OPENROUTER;
  if (normalized.includes('api.deepseek.com')) return AI_PROVIDERS.DEEPSEEK;
  if (normalized.includes('localhost:11434') || normalized.includes('127.0.0.1:11434')) return AI_PROVIDERS.OLLAMA;
  return AI_PROVIDERS.OPENAI_COMPATIBLE;
}

export function getAiProviderCapabilities(provider: AiProvider): AiCapability[] {
  return [...AI_PROVIDER_CAPABILITIES[provider]];
}
