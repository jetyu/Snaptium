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

interface TestConnectionConfig {
  aiEndpoint: string;
  aiApiKey: string;
  aiModel: string;
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

  async testConnection(config: TestConnectionConfig): Promise<{ success: boolean; message?: string }> {
    const { aiEndpoint, aiApiKey, aiModel } = config;
    const isEmbeddingModel = aiModel.toLowerCase().includes('embed');

    const runTest = async (isEmbed: boolean): Promise<JsonObject> => {
      const payload: JsonObject = isEmbed
        ? { model: aiModel, input: ['test'] }
        : { model: aiModel, messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 };

      return await this.request<JsonObject>(aiEndpoint, aiApiKey, payload);
    };

    try {
      await runTest(isEmbeddingModel);
      return { success: true };
    } catch (firstError) {
      if (!isEmbeddingModel) {
        logger.info('Chat connectivity test failed, trying embedding fallback');
        try {
          await runTest(true);
          return { success: true };
        } catch {
          return { success: false, message: getErrorMessage(firstError) };
        }
      }

      return { success: false, message: getErrorMessage(firstError) };
    }
  },
};
