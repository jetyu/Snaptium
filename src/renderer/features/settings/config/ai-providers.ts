import { AI_PROVIDERS, type AiProvider } from '@shared/ai-provider.constants';
import snaptiumLogoUrl from '@assets/logo/app-logo-32.png';
import openAiLogoUrl from '@assets/images/ai-providers/openai.svg';
import siliconFlowLogoUrl from '@assets/images/ai-providers/siliconflow.svg';
import geminiLogoUrl from '@assets/images/ai-providers/gemini.svg';
import ollamaLogoUrl from '@assets/images/ai-providers/ollama.svg';
import openRouterLogoUrl from '@assets/images/ai-providers/openrouter.svg';
import deepSeekLogoUrl from '@assets/images/ai-providers/deepseek.svg';
import qwenLogoUrl from '@assets/images/ai-providers/qwen.svg';
import doubaoLogoUrl from '@assets/images/ai-providers/doubao.svg';
import kimiLogoUrl from '@assets/images/ai-providers/kimi.svg';
import zhipuLogoUrl from '@assets/images/ai-providers/zhipu.svg';
import grokLogoUrl from '@assets/images/ai-providers/grok.svg';

export interface AiProviderPresentation {
  label: string;
  logoUrl?: string;
}

export const AI_PROVIDER_PRESENTATIONS = {
  [AI_PROVIDERS.SNAPTIUM]: { label: 'Snaptium', logoUrl: snaptiumLogoUrl },
  [AI_PROVIDERS.SILICONFLOW]: { label: 'SiliconFlow', logoUrl: siliconFlowLogoUrl },
  [AI_PROVIDERS.OPENAI]: { label: 'OpenAI', logoUrl: openAiLogoUrl },
  [AI_PROVIDERS.OPENAI_COMPATIBLE]: { label: 'OpenAI Compatible' },
  [AI_PROVIDERS.GOOGLE_GEMINI]: { label: 'Google Gemini', logoUrl: geminiLogoUrl },
  [AI_PROVIDERS.OLLAMA]: { label: 'Ollama', logoUrl: ollamaLogoUrl },
  [AI_PROVIDERS.OPENROUTER]: { label: 'OpenRouter', logoUrl: openRouterLogoUrl },
  [AI_PROVIDERS.DEEPSEEK]: { label: 'DeepSeek', logoUrl: deepSeekLogoUrl },
  [AI_PROVIDERS.QWEN]: { label: 'Qwen', logoUrl: qwenLogoUrl },
  [AI_PROVIDERS.DOUBAO]: { label: 'Doubao', logoUrl: doubaoLogoUrl },
  [AI_PROVIDERS.KIMI]: { label: 'Kimi', logoUrl: kimiLogoUrl },
  [AI_PROVIDERS.ZHIPU]: { label: 'Zhipu AI (GLM)', logoUrl: zhipuLogoUrl },
  [AI_PROVIDERS.GROK]: { label: 'Grok (xAI)', logoUrl: grokLogoUrl },
} as const satisfies Record<AiProvider, AiProviderPresentation>;

export const SELECTABLE_AI_PROVIDERS: AiProvider[] = [
  AI_PROVIDERS.OPENAI,
  AI_PROVIDERS.SILICONFLOW,
  AI_PROVIDERS.OPENAI_COMPATIBLE,
  AI_PROVIDERS.GOOGLE_GEMINI,
  AI_PROVIDERS.DEEPSEEK,
  AI_PROVIDERS.QWEN,
  AI_PROVIDERS.DOUBAO,
  AI_PROVIDERS.KIMI,
  AI_PROVIDERS.ZHIPU,
  AI_PROVIDERS.GROK,
  AI_PROVIDERS.OLLAMA,
  AI_PROVIDERS.OPENROUTER,
];

export function getAiProviderPresentation(provider: AiProvider): AiProviderPresentation {
  return AI_PROVIDER_PRESENTATIONS[provider];
}
