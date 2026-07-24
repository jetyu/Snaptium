import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { ChatOllama, OllamaEmbeddings } from '@langchain/ollama';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { Embeddings } from '@langchain/core/embeddings';
import { BaseDocumentCompressor } from '@langchain/core/retrievers/document_compressors';
import type { DocumentInterface } from '@langchain/core/documents';
import { AI_PROVIDERS, type AiProvider } from '../../shared/ai-provider.constants.js';
import { remoteAiService } from './remote-ai.service.js';

export interface AiProviderModelConfig {
  provider: AiProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
}

class SiliconFlowReranker extends BaseDocumentCompressor {
  constructor(private readonly config: AiProviderModelConfig) {
    super();
  }

  async compressDocuments(documents: DocumentInterface[], query: string): Promise<DocumentInterface[]> {
    const ranked = await remoteAiService.rerank({
      endpoint: remoteAiService.resolveCapabilityEndpoint(this.config.baseUrl, 'reranker'),
      apiKey: this.config.apiKey,
      model: this.config.model,
      query,
      documents: documents.map((document) => document.pageContent),
    });

    const results: DocumentInterface[] = [];
    for (const item of ranked) {
      const document = documents[item.index];
      if (!document) continue;
      results.push({
        ...document,
        metadata: { ...document.metadata, relevanceScore: item.score },
      });
    }
    return results;
  }
}

function isOpenAiCompatibleProvider(provider: AiProvider): boolean {
  return provider === AI_PROVIDERS.SNAPTIUM
    || provider === AI_PROVIDERS.OPENAI
    || provider === AI_PROVIDERS.OPENAI_COMPATIBLE
    || provider === AI_PROVIDERS.SILICONFLOW
    || provider === AI_PROVIDERS.OPENROUTER
    || provider === AI_PROVIDERS.DEEPSEEK
    || provider === AI_PROVIDERS.QWEN
    || provider === AI_PROVIDERS.DOUBAO
    || provider === AI_PROVIDERS.KIMI
    || provider === AI_PROVIDERS.ZHIPU
    || provider === AI_PROVIDERS.GROK;
}

function requireApiKey(config: AiProviderModelConfig): string {
  if (!config.apiKey && config.provider !== AI_PROVIDERS.OLLAMA) {
    throw new Error('Missing AI provider API key');
  }
  return config.apiKey;
}

export function createProviderChatModel(config: AiProviderModelConfig): BaseChatModel {
  const apiKey = requireApiKey(config);
  if (isOpenAiCompatibleProvider(config.provider)) {
    return new ChatOpenAI({
      apiKey,
      model: config.model,
      temperature: 0,
      maxRetries: 2,
      configuration: { baseURL: config.baseUrl },
    });
  }

  if (config.provider === AI_PROVIDERS.GOOGLE_GEMINI) {
    return new ChatGoogleGenerativeAI({ apiKey, model: config.model, temperature: 0, baseUrl: config.baseUrl });
  }

  if (config.provider === AI_PROVIDERS.OLLAMA) {
    return new ChatOllama({ model: config.model, baseUrl: config.baseUrl, temperature: 0 });
  }

  throw new Error(`Provider ${config.provider} does not support chat models`);
}

export function createProviderEmbeddings(config: AiProviderModelConfig): Embeddings {
  const apiKey = requireApiKey(config);
  if (isOpenAiCompatibleProvider(config.provider)) {
    return new OpenAIEmbeddings({ apiKey, model: config.model, configuration: { baseURL: config.baseUrl } });
  }

  if (config.provider === AI_PROVIDERS.GOOGLE_GEMINI) {
    return new GoogleGenerativeAIEmbeddings({ apiKey, model: config.model, baseUrl: config.baseUrl });
  }

  if (config.provider === AI_PROVIDERS.OLLAMA) {
    return new OllamaEmbeddings({ model: config.model, baseUrl: config.baseUrl });
  }

  throw new Error(`Provider ${config.provider} does not support embeddings`);
}

export function createProviderReranker(config: AiProviderModelConfig): BaseDocumentCompressor {
  requireApiKey(config);
  if (config.provider === AI_PROVIDERS.SILICONFLOW
    || config.provider === AI_PROVIDERS.OPENAI_COMPATIBLE
    || config.provider === AI_PROVIDERS.SNAPTIUM) {
    return new SiliconFlowReranker(config);
  }

  throw new Error(`Provider ${config.provider} does not support reranking`);
}
