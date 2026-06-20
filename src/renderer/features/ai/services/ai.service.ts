import { electronApi } from '@renderer/core/bridge/electronApi';
import { createLogger } from '@renderer/features/logger';
import type { AiPromptPreset } from '@shared/ai.constants';
import { getErrorMessage } from '@shared/utils/error.utils';
import { AI_ERROR_MESSAGES } from '../constants/ai.constants';

const aiLogger = createLogger('Renderer:AiService');

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiGenerateRequest {
  messages: AiChatMessage[];
  // Optional explicit override. Built-in prompts are always resolved in main.
  systemPrompt?: string;
  promptPreset?: AiPromptPreset;
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
      const response = await electronApi.aiChat.generate({
        messages: [...request.messages],
        systemPrompt: request.systemPrompt,
        promptPreset: request.promptPreset,
      });

      return response;
    } catch (error: unknown) {
      const message = getErrorMessage(error);
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
      const message = getErrorMessage(error);
      aiLogger.error('Completion generation failed', { error: message });
      return { success: false, error: message };
    }
  }
};
