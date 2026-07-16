import { AI_PROVIDERS, type AiProvider } from '@shared/ai-provider.constants';

export interface AiProviderPresentation {
  label: string;
}

export const AI_PROVIDER_PRESENTATIONS = {
  [AI_PROVIDERS.SNAPTIUM]: { label: 'Snaptium' },
  [AI_PROVIDERS.SILICONFLOW]: { label: 'SiliconFlow' },
  [AI_PROVIDERS.OPENAI]: { label: 'OpenAI' },
  [AI_PROVIDERS.OPENAI_COMPATIBLE]: { label: 'OpenAI Compatible' },
  [AI_PROVIDERS.GOOGLE_GEMINI]: { label: 'Google Gemini' },
  [AI_PROVIDERS.OLLAMA]: { label: 'Ollama' },
  [AI_PROVIDERS.OPENROUTER]: { label: 'OpenRouter' },
  [AI_PROVIDERS.DEEPSEEK]: { label: 'DeepSeek' },
} as const satisfies Record<AiProvider, AiProviderPresentation>;

export const SELECTABLE_AI_PROVIDERS: AiProvider[] = [
  AI_PROVIDERS.OPENAI,
  AI_PROVIDERS.SILICONFLOW,
  AI_PROVIDERS.OPENAI_COMPATIBLE,
  AI_PROVIDERS.GOOGLE_GEMINI, 
  AI_PROVIDERS.DEEPSEEK,
  AI_PROVIDERS.OLLAMA,
  AI_PROVIDERS.OPENROUTER,

];

export function getAiProviderPresentation(provider: AiProvider): AiProviderPresentation {
  return AI_PROVIDER_PRESENTATIONS[provider];
}
