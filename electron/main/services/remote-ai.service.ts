import { loggerService } from './logger.service.js';
import { getErrorMessage } from '../services/error.service.js';
import { isElectronNetworkRequestError, mainProcessFetch } from './network.service.js';

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

export interface AiChatStreamChunk {
  content: string;
}

export interface AiChatStreamResult {
  content: string;
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
  code?: string;
  error?: {
    code?: string;
    message?: string;
  };
  message?: string;
  details?: Record<string, unknown>;
}

function valueToDetailText(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function formatRequestErrorDetails(details: Record<string, unknown> | undefined): string[] {
  if (!details) {
    return [];
  }

  const detailKeys = [
    ['plan', 'plan'],
    ['capability', 'capability'],
    ['provider', 'provider'],
    ['secret_name', 'secret'],
    ['upstream_status', 'upstream status'],
    ['upstream_content_type', 'content-type'],
    ['response_preview', 'preview'],
  ] as const;

  return detailKeys
    .map(([key, label]) => {
      const value = valueToDetailText(details[key]);
      return value ? `${label}: ${value}` : null;
    })
    .filter((item): item is string => item !== null);
}

function formatErrorCause(cause: unknown): string | null {
  if (typeof cause !== 'object' || cause === null) {
    return null;
  }

  const record = cause as Record<string, unknown>;
  const parts = [
    valueToDetailText(record.message),
    valueToDetailText(record.code),
    valueToDetailText(record.hostname),
    valueToDetailText(record.address),
    valueToDetailText(record.port),
  ].filter((item): item is string => item !== null);

  return parts.length > 0 ? parts.join(' / ') : null;
}

function isFetchNetworkError(error: unknown): error is Error {
  return isElectronNetworkRequestError(error) || (error instanceof TypeError && error.message === 'fetch failed');
}

function extractRequestErrorMessage(body: unknown, fallback: string): string {
  if (typeof body !== 'object' || body === null) {
    return fallback;
  }

  const record = body as RequestErrorBody;
  const code = typeof record.code === 'string' && record.code.trim().length > 0
    ? record.code.trim()
    : typeof record.error?.code === 'string' && record.error.code.trim().length > 0
      ? record.error.code.trim()
      : null;
  const detailParts = formatRequestErrorDetails(record.details);
  if (typeof record.error?.message === 'string' && record.error.message.trim().length > 0) {
    return [record.error.message.trim(), code ? `code: ${code}` : null, ...detailParts]
      .filter((item): item is string => item !== null)
      .join(' | ');
  }

  if (typeof record.message === 'string' && record.message.trim().length > 0) {
    return [record.message.trim(), code ? `code: ${code}` : null, ...detailParts]
      .filter((item): item is string => item !== null)
      .join(' | ');
  }

  return [fallback, code ? `code: ${code}` : null, ...detailParts]
    .filter((item): item is string => item !== null)
    .join(' | ');
}

function extractStreamDeltaContent(value: unknown): string {
  if (typeof value !== 'object' || value === null) {
    return '';
  }

  const record = value as Record<string, unknown>;
  const choices = Array.isArray(record.choices) ? record.choices : [];
  return choices
    .map((choice) => {
      if (typeof choice !== 'object' || choice === null) {
        return '';
      }

      const choiceRecord = choice as Record<string, unknown>;
      const delta = choiceRecord.delta;
      if (typeof delta !== 'object' || delta === null) {
        return '';
      }

      const content = (delta as Record<string, unknown>).content;
      return typeof content === 'string' ? content : '';
    })
    .join('');
}

async function readStreamErrorBody(response: Response, fallback: string): Promise<string> {
  const contentType = response.headers.get('Content-Type') || '';
  if (contentType.includes('application/json')) {
    const errorData = await response.json().catch(() => null);
    return extractRequestErrorMessage(errorData, fallback);
  }

  const text = await response.text().catch(() => '');
  return text.trim() || fallback;
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
      const response = await mainProcessFetch(endpoint, {
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

      if (isFetchNetworkError(error)) {
        const cause = isElectronNetworkRequestError(error)
          ? getErrorMessage(error)
          : formatErrorCause(error.cause);
        throw new Error(
          cause ? `AI service network request failed: ${cause}` : 'AI service network request failed.',
          { cause: error },
        );
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

  async chatStream(
    config: ChatConfig,
    onChunk: (chunk: AiChatStreamChunk) => void,
  ): Promise<AiChatStreamResult> {
    const { endpoint, apiKey, model, messages, max_tokens, temperature, tools, tool_choice } = config;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);
    let accumulated = '';

    try {
      const response = await mainProcessFetch(endpoint, {
        method: 'POST',
        headers: this.getHeaders(apiKey),
        body: JSON.stringify({
          model,
          messages,
          max_tokens: max_tokens ?? 512,
          temperature: temperature ?? 0.7,
          stream: true,
          ...(tools?.length ? { tools } : {}),
          ...(tool_choice ? { tool_choice } : {}),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const fallback = `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(await readStreamErrorBody(response, fallback));
      }

      const contentType = response.headers.get('Content-Type') || '';
      if (!contentType.includes('text/event-stream')) {
        throw new Error(`Streaming response is not supported by this AI service (got ${contentType || 'unknown content type'})`);
      }

      if (!response.body) {
        throw new Error('AI service returned an empty streaming response');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let done = false;

      while (!done) {
        const result = await reader.read();
        done = result.done;
        buffer += decoder.decode(result.value ?? new Uint8Array(), { stream: !done });

        const eventBuffer = done && buffer.trim().length > 0 ? `${buffer}\n\n` : buffer;
        const events = eventBuffer.split('\n\n');
        buffer = done ? '' : events.pop() ?? '';

        for (const event of events) {
          const dataLines = event
            .split(/\r?\n/)
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trim());
          for (const data of dataLines) {
            if (!data || data === '[DONE]') {
              continue;
            }

            const parsed = JSON.parse(data) as unknown;
            const content = extractStreamDeltaContent(parsed);
            if (content) {
              accumulated += content;
              onChunk({ content });
            }
          }
        }
      }

      return { content: accumulated };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout', { cause: error });
      }

      if (isFetchNetworkError(error)) {
        const cause = isElectronNetworkRequestError(error)
          ? getErrorMessage(error)
          : formatErrorCause(error.cause);
        throw new Error(
          cause ? `AI service network request failed: ${cause}` : 'AI service network request failed.',
          { cause: error },
        );
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
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
