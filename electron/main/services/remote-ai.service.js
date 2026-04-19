import { loggerService } from './logger.service.js';

const logger = loggerService.createLogger('Electron:Remote AI Service');

/**
 * Remote AI Service (Main Process)
 * Centralized service for OpenAI-compatible API communications
 */
export const remoteAiService = {
  /**
   * Common headers for all AI requests
   */
  getHeaders(apiKey) {
    return {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/jetyu/NoteWizard',
      'X-Title': 'NoteWizard',
    };
  },

  /**
   * Generic POST request wrapper
   * @param {string} endpoint - API full URL
   * @param {string} apiKey - API key
   * @param {Object} payload - The body of the request
   * @returns {Promise<any>}
   */
  async request(endpoint, apiKey, payload) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

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
        const errorData = isJson ? await response.json().catch(() => null) : null;
        const errorMsg = errorData?.error?.message || errorData?.message || `HTTP ${response.status}: ${response.statusText}`;
        logger.error('AI API request failed', {
          error: errorMsg,
          details: errorData,
          status: response.status,
        });
        throw new Error(errorMsg);
      }

      if (!isJson) {
        throw new Error(`Invalid response format (Expected JSON, got ${contentType})`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  },

  /**
   * Call Chat Completion endpoint
   */
  async chat(config) {
    const { endpoint, apiKey, model, messages, max_tokens, temperature, stream } = config;

    return await this.request(endpoint, apiKey, {
      model,
      messages,
      max_tokens: max_tokens || 512,
      temperature: temperature !== undefined ? temperature : 0.7,
      stream: !!stream,
    });
  },

  /**
   * Call Embedding endpoint
   */
  async embed(config) {
    const { endpoint, apiKey, model, input } = config;

    let normalizedInput = Array.isArray(input) ? input : [input];

    normalizedInput = normalizedInput.filter(text => typeof text === 'string' && text.trim().length > 0);

    return await this.request(endpoint, apiKey, {
      model,
      input: normalizedInput,
    });
  },


  /**
   * Perform a smart connectivity test
   * Tries Chat format first (unless model name suggests embedding), then falls back to Embedding.
   */
  async testConnection(config) {
    const { aiEndpoint, aiApiKey, aiModel } = config;
    const isEmbeddingModel = aiModel.toLowerCase().includes('embed');

    try {
      const runTest = async (isEmbed) => {
        const payload = isEmbed
          ? { model: aiModel, input: ['test'] }
          : { model: aiModel, messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 };

        return await this.request(aiEndpoint, aiApiKey, payload);
      };

      try {
        // Step 1: Try based on primary detection
        await runTest(isEmbeddingModel);
        return { success: true };
      } catch (firstError) {
        // Step 2: Fallback to the other type if the first one fails and it's plausible
        if (!isEmbeddingModel) {
          logger.info('Chat connectivity test failed, trying embedding fallback');
          try {
            await runTest(true);
            return { success: true };
          } catch (secondError) {
            return { success: false, message: firstError.message };
          }
        }
        return { success: false, message: firstError.message };
      }
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
};
