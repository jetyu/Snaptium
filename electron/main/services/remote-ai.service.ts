import { loggerService } from './logger.service.js';
import { getErrorMessage } from '../services/error.service.js';

const logger = loggerService.createLogger('Electron:Remote AI Service');

type JsonObject = Record<string, unknown>;

export interface AiChatToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export type AiChatMessage =
  | {
    role: 'system' | 'user';
    content: string;
  }
  | {
    role: 'assistant';
    content?: string | null;
    tool_calls?: AiChatToolCall[];
  }
  | {
    role: 'tool';
    content: string;
    tool_call_id: string;
  };

export interface AiChatTool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: JsonObject;
  };
}

export type AiChatToolChoice =
  | 'auto'
  | 'none'
  | {
    type: 'function';
    function: {
      name: string;
    };
  };

interface RequestConfig {
  endpoint: string;
  apiKey: string;
}

interface ChatConfig extends RequestConfig {
  model: string;
  messages: AiChatMessage[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
  tools?: AiChatTool[];
  tool_choice?: AiChatToolChoice;
}

interface EmbedConfig extends RequestConfig {
  model: string;
  input: string | string[];
}

interface RerankConfig extends RequestConfig {
  model: string;
  query: string;
  documents: string[];
}

interface TestConnectionConfig {
  aiBaseUrl: string;
  aiApiKey: string;
  aiModel: string;
  capabilities: string[];
}

interface ChatChoice {
  message?: {
    content?: string | null;
    tool_calls?: AiChatToolCall[];
  };
  finish_reason?: string;
}

interface ChatResponse extends JsonObject {
  choices?: ChatChoice[];
}

interface EmbeddingItem {
  embedding?: unknown;
}

interface EmbeddingResponse extends JsonObject {
  data?: EmbeddingItem[];
}

interface RerankResultItem {
  index?: unknown;
  relevance_score?: unknown;
  score?: unknown;
}

interface RerankResponse extends JsonObject {
  results?: RerankResultItem[];
  data?: RerankResultItem[];
}

interface RequestErrorBody {
  error?: {
    message?: string;
  };
  message?: string;
}

function extractRequestErrorMessage(body: unknown, fallback: string): string {
  if (typeof body !== 'object' || body === null) {
    return fallback;
  }

  const record = body as RequestErrorBody;
  if (typeof record.error?.message === 'string' && record.error.message.trim().length > 0) {
    return record.error.message;
  }

  if (typeof record.message === 'string' && record.message.trim().length > 0) {
    return record.message;
  }

  return fallback;
}

/**
 * Remote AI Service (Main Process)
 * Centralized service for OpenAI-compatible API communications.
 */
export const remoteAiService = {
  normalizeBaseUrl(baseUrl: string): string {
    return baseUrl.trim().replace(/\/+$/, '');
  },

  resolveCapabilityEndpoint(baseUrl: string, capability: 'chat' | 'embedding' | 'reranker'): string {
    const normalizedBaseUrl = this.normalizeBaseUrl(baseUrl);
    if (!normalizedBaseUrl) {
      throw new Error('Missing AI base URL');
    }

    if (capability === 'chat') {
      return `${normalizedBaseUrl}/chat/completions`;
    }

    if (capability === 'embedding') {
      return `${normalizedBaseUrl}/embeddings`;
    }

    return `${normalizedBaseUrl}/rerank`;
  },

  getHeaders(apiKey: string): Record<string, string> {
    return {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://snaptium.com',
      'X-Title': 'Snaptium AI API Request',
    };
  },

  async request<TResponse extends JsonObject>(
    endpoint: string,
    apiKey: string,
    payload: JsonObject,
  ): Promise<TResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: this.getHeaders(apiKey),
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get('Content-Type') || '';
      const isJson = contentType.includes('application/json');

      if (!response.ok) {
        const errorData = isJson
          ? await response.json().catch(() => null)
          : null;
        const fallback = `HTTP ${response.status}: ${response.statusText}`;
        const errorMessage = extractRequestErrorMessage(errorData, fallback);
        logger.error('AI API request failed', {
          error: errorMessage,
          details: errorData,
          status: response.status,
        });
        throw new Error(errorMessage);
      }

      if (!isJson) {
        throw new Error(`Invalid response format (Expected JSON, got ${contentType})`);
      }

      const data = await response.json();
      if (typeof data !== 'object' || data === null) {
        throw new Error('Invalid JSON response payload');
      }

      return data as TResponse;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout', { cause: error });
      }

      throw error;
    }
  },

  async chat(config: ChatConfig): Promise<ChatResponse> {
    const { endpoint, apiKey, model, messages, max_tokens, temperature, stream, tools, tool_choice } = config;

    return await this.request<ChatResponse>(endpoint, apiKey, {
      model,
      messages,
      max_tokens: max_tokens ?? 512,
      temperature: temperature ?? 0.7,
      stream: Boolean(stream),
      ...(tools?.length ? { tools } : {}),
      ...(tool_choice ? { tool_choice } : {}),
    });
  },

  async embed(config: EmbedConfig): Promise<EmbeddingResponse> {
    const { endpoint, apiKey, model, input } = config;
    const sourceInput = Array.isArray(input) ? input : [input];
    const normalizedInput = sourceInput.filter(
      (text): text is string => typeof text === 'string' && text.trim().length > 0,
    );

    return await this.request<EmbeddingResponse>(endpoint, apiKey, {
      model,
      input: normalizedInput,
    });
  },

  async rerank(config: RerankConfig): Promise<Array<{ index: number; score: number }>> {
    const { endpoint, apiKey, model, query, documents } = config;
    const response = await this.request<RerankResponse>(endpoint, apiKey, {
      model,
      query,
      documents,
      top_n: documents.length,
    });

    const candidateResults = Array.isArray(response.results)
      ? response.results
      : Array.isArray(response.data)
        ? response.data
        : [];

    return candidateResults
      .map((item) => ({
        index: Number(item.index),
        score: Number(item.relevance_score ?? item.score),
      }))
      .filter((item) => Number.isInteger(item.index) && item.index >= 0 && Number.isFinite(item.score))
      .sort((left, right) => right.score - left.score);
  },

  async testConnection(config: TestConnectionConfig): Promise<{ success: boolean; message?: string }> {
    const { aiBaseUrl, aiApiKey, aiModel, capabilities } = config;
    const normalizedCapabilities = capabilities.length > 0 ? capabilities : ['chat', 'embedding', 'reranker'];
    const orderedCapabilities: Array<'chat' | 'embedding' | 'reranker'> = ['chat', 'embedding', 'reranker'];
    const requestedCapabilities = orderedCapabilities.filter((capability) => normalizedCapabilities.includes(capability));

    const runTest = async (capability: 'chat' | 'embedding' | 'reranker'): Promise<JsonObject> => {
      const endpoint = this.resolveCapabilityEndpoint(aiBaseUrl, capability);
      const payload: JsonObject = capability === 'chat'
        ? { model: aiModel, messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 }
        : capability === 'embedding'
          ? { model: aiModel, input: ['test'] }
          : { model: aiModel, query: 'test', documents: ['hello', 'world'], top_n: 2 };

      return await this.request<JsonObject>(endpoint, aiApiKey, payload);
    };

    let lastError: unknown = null;
    for (const capability of requestedCapabilities) {
      try {
        await runTest(capability);
        return { success: true };
      } catch (error) {
        lastError = error;
        logger.info(`AI source ${capability} connectivity test failed`, {
          error: getErrorMessage(error),
        });
      }
    }

    return {
      success: false,
      message: getErrorMessage(lastError, 'Failed to connect to AI source'),
    };
  },
};
