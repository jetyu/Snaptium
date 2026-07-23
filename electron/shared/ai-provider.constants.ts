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
  QWEN: 'qwen',
  DOUBAO: 'doubao',
  KIMI: 'kimi',
  ZHIPU: 'zhipu',
  GROK: 'grok',
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
  [AI_PROVIDERS.QWEN]: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  [AI_PROVIDERS.DOUBAO]: 'https://ark.cn-beijing.volces.com/api/v3',
  [AI_PROVIDERS.KIMI]: 'https://api.moonshot.ai/v1',
  [AI_PROVIDERS.ZHIPU]: 'https://open.bigmodel.cn/api/paas/v4',
  [AI_PROVIDERS.GROK]: 'https://api.x.ai/v1',
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
  [AI_PROVIDERS.QWEN]: ['chat'],
  [AI_PROVIDERS.DOUBAO]: ['chat'],
  [AI_PROVIDERS.KIMI]: ['chat'],
  [AI_PROVIDERS.ZHIPU]: ['chat'],
  [AI_PROVIDERS.GROK]: ['chat'],
} as const satisfies Record<AiProvider, readonly AiCapability[]>;

const AI_PROVIDER_SET = new Set<string>(Object.values(AI_PROVIDERS));

const AI_PROVIDER_BY_HOSTNAME = new Map<string, AiProvider>([
  ['api.snaptium.com', AI_PROVIDERS.SNAPTIUM],
  ['api.siliconflow.cn', AI_PROVIDERS.SILICONFLOW],
  ['api.openai.com', AI_PROVIDERS.OPENAI],
  ['generativelanguage.googleapis.com', AI_PROVIDERS.GOOGLE_GEMINI],
  ['openrouter.ai', AI_PROVIDERS.OPENROUTER],
  ['api.deepseek.com', AI_PROVIDERS.DEEPSEEK],
  ['dashscope.aliyuncs.com', AI_PROVIDERS.QWEN],
  ['maas.aliyuncs.com', AI_PROVIDERS.QWEN],
  ['ark.cn-beijing.volces.com', AI_PROVIDERS.DOUBAO],
  ['api.moonshot.ai', AI_PROVIDERS.KIMI],
  ['open.bigmodel.cn', AI_PROVIDERS.ZHIPU],
  ['api.x.ai', AI_PROVIDERS.GROK],
]);

export function isAiProvider(value: unknown): value is AiProvider {
  return typeof value === 'string' && AI_PROVIDER_SET.has(value);
}

export function inferAiProvider(baseUrl: string): AiProvider {
  try {
    const parsedUrl = new URL(baseUrl.trim());
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return AI_PROVIDERS.OPENAI_COMPATIBLE;
    }

    const hostname = parsedUrl.hostname.toLowerCase();
    if ((hostname === 'localhost' || hostname === '127.0.0.1') && parsedUrl.port === '11434') {
      return AI_PROVIDERS.OLLAMA;
    }

    return AI_PROVIDER_BY_HOSTNAME.get(hostname) ?? AI_PROVIDERS.OPENAI_COMPATIBLE;
  } catch {
    return AI_PROVIDERS.OPENAI_COMPATIBLE;
  }
}

export function getAiProviderCapabilities(provider: AiProvider): AiCapability[] {
  return [...AI_PROVIDER_CAPABILITIES[provider]];
}
