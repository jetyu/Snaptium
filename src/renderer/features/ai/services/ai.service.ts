import { electronApi } from '@renderer/core/bridge/electronApi';
import { createLogger } from '@renderer/features/logger';
import { AI_ERROR_MESSAGES } from '../constants/ai.constants';

const aiLogger = createLogger('Renderer:AiService');

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiGenerateRequest {
  messages: AiChatMessage[];
  systemPrompt?: string;
}

/**
 * Unified AI Service - Orchestration Layer
 * Acts as the single entry point for all AI capabilities in the renderer.
 */
export const aiService = {
  /**
   * Core assistant generation using main-process configuration
   */
  async generate(request: AiGenerateRequest): Promise<{ success: boolean; answer?: string; error?: string }> {
    try {
      const messages = [...request.messages];

      // Inject system prompt if provided and not already present
      if (request.systemPrompt && !messages.find(m => m.role === 'system')) {
        messages.unshift({ role: 'system', content: request.systemPrompt });
      }

      const response = await electronApi.aiChat.generate({ messages });

      return response;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      aiLogger.error('AI generation failed', { error: message });
      return { success: false, error: message };
    }
  },

  /**
   * Specialized writing completion (Assistant) - Orchestration Layer
   */
  async generateCompletion(params: {
    context: string;
    systemPrompt?: string;
  }): Promise<{ success: boolean; answer?: string; error?: string }> {
    const { context, systemPrompt } = params;

    try {
      if (!context.trim()) {
        return { success: false, error: AI_ERROR_MESSAGES.INVALID_CONTEXT };
      }

      return await electronApi.aiChat.generateCompletion({
        context,
        systemPrompt,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      aiLogger.error('Completion generation failed', { error: message });
      return { success: false, error: message };
    }
  }
};
