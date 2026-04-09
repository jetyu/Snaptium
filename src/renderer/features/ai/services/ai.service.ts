import { electronApi } from '@renderer/core/bridge/electronApi';
import { createLogger } from '@renderer/features/logger';

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
    } catch (error: any) {
      aiLogger.error('AI generation failed', { error: error.message });
      return { success: false, error: error.message };
    }
  },

  /**
   * Specialized RAG answer generation
   */
  async generateRagAnswer(params: {
    query: string;
    contexts: string[];
    config: { endpoint: string; apiKey: string; model: string };
  }) {
    const { query, contexts, config } = params;

    const systemPrompt = `You are a helpful AI assistant for a note-taking app called NoteWizard. 
Use the following context snippets from the user's notes to answer the question. 
If the answer is not in the context, say you don't know based on the notes, but try to be helpful generally.

Context:
${contexts.join('\n---\n')}
`;

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
      // 1. Load settings (Business Logic)
      const config = await electronApi.settings.getConfig();
      const { aiAssistant, aiSources } = config as any;

      if (!aiAssistant?.enabled) {
        return { success: false, error: 'AI Assistant is disabled' };
      }

      const source = aiSources?.find((s: any) => s.id === aiAssistant.sourceId);
      if (!source) {
        return { success: false, error: 'AI source not found' };
      }

      const model = aiAssistant.model || source.aiModel;
      const systemPrompt = aiAssistant.systemPrompt?.trim() || "You are a writing assistant. Continue the user's text naturally and concisely. Provide only the continuation text without any preamble or quotes.";

      // 2. Coordinate AI via unified entry
      return await this.generate({
        endpoint: source.endpoint,
        apiKey: source.apiKey,
        model,
        systemPrompt,
        messages: [{ role: 'user', content: context }],
      });
    } catch (error: any) {
      aiLogger.error('Completion generation failed', { error: error.message });
      return { success: false, error: error.message };
    }
  }
};
