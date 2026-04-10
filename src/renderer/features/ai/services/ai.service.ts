import { electronApi } from '@renderer/core/bridge/electronApi';
import { createLogger } from '@renderer/features/logger';
import { AI_ERROR_MESSAGES } from '../constants/ai.constants';
import i18n from '@renderer/features/i18n';

const aiLogger = createLogger('Renderer:AiService');

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiGenerateRequest {
  endpoint: string;
  apiKey: string;
  model: string;
  messages: AiChatMessage[];
  systemPrompt?: string;
}

interface AiSource {
  id: string;
  endpoint: string;
  apiKey: string;
  aiModel: string;
}

interface AiAssistantConfig {
  enabled?: boolean;
  sourceId?: string;
  model?: string;
  systemPrompt?: string;
}

interface AppConfig {
  aiAssistant?: AiAssistantConfig;
  aiSources?: AiSource[];
}

/**
 * Unified AI Service - Orchestration Layer
 * Acts as the single entry point for all AI capabilities in the renderer.
 */
export const aiService = {
  /**
   * Core generation method
   */
  async generate(request: AiGenerateRequest): Promise<{ success: boolean; answer?: string; error?: string }> {
    try {
      const messages = [...request.messages];

      // Inject system prompt if provided and not already present
      if (request.systemPrompt && !messages.find(m => m.role === 'system')) {
        messages.unshift({ role: 'system', content: request.systemPrompt });
      }

      const response = await electronApi.aiChat.generate({
        endpoint: request.endpoint,
        apiKey: request.apiKey,
        model: request.model,
        messages,
      });

      return response;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      aiLogger.error('AI generation failed', { error: message });
      return { success: false, error: message };
    }
  },

  /**
   * Specialized RAG answer generation.
   * The caller is responsible for building the system prompt (e.g. injecting context snippets),
   * keeping this service free of RAG-specific knowledge.
   */
  async generateRagAnswer(params: {
    query: string;
    systemPrompt: string;
    config: { endpoint: string; apiKey: string; model: string };
  }) {
    const { query, systemPrompt, config } = params;
    return this.generate({
      ...config,
      systemPrompt,
      messages: [{ role: 'user', content: query }],
    });
  },

  /**
   * Specialized writing completion (Assistant) - Orchestration Layer
   */
  async generateCompletion(params: {
    context: string;
  }): Promise<{ success: boolean; answer?: string; error?: string }> {
    const { context } = params;

    try {
      const rawConfig = await electronApi.settings.getConfig();
      const config = rawConfig as unknown as AppConfig;
      const { aiAssistant, aiSources } = config;

      if (!aiAssistant?.enabled) {
        return { success: false, error: AI_ERROR_MESSAGES.DISABLED };
      }

      const source = aiSources?.find(s => s.id === aiAssistant.sourceId);
      if (!source) {
        return { success: false, error: AI_ERROR_MESSAGES.NO_SOURCE };
      }

      const model = aiAssistant.model || source.aiModel;
      const systemPrompt = aiAssistant.systemPrompt?.trim() || i18n.global.t('ai.prompt.autoComplete');

      return await this.generate({
        endpoint: source.endpoint,
        apiKey: source.apiKey,
        model,
        systemPrompt,
        messages: [{ role: 'user', content: context }],
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      aiLogger.error('Completion generation failed', { error: message });
      return { success: false, error: message };
    }
  }
};
