/**
 * AI Service for Main Process
 * Handles communication with OpenAI-compatible APIs
 */
export const aiService = {
  /**
   * Test the connectivity to the AI provider
   * @param {Object} config - AI configuration (endpoint, apiKey, model)
   * @returns {Promise<{success: boolean, message?: string}>}
   */
  async testConnection(config) {
    const { aiEndpoint, aiApiKey, aiModel } = config;

    if (!aiEndpoint || !aiApiKey || !aiModel) {
      return { success: false, message: 'Missing required configuration fields' };
    }

    try {
      console.log(`[AI Service] Testing connection (Model: ${aiModel})...`);
      console.log(`[AI Service] Endpoint: ${aiEndpoint}`);
      
      const fetchOptions = {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${aiApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/jetyu/NoteWizard',
          'X-Title': 'NoteWizard',
        },
        body: JSON.stringify({
          model: aiModel,
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 5,
        }),
      };

      const response = await fetch(aiEndpoint, fetchOptions);

      const contentType = response.headers.get('Content-Type') || '';
      const isJson = contentType.includes('application/json');
      
      if (response.ok) {
        if (!isJson) {
           return { success: false, message: `Connected but invalid format (Not JSON). Content-Type: ${contentType}` };
        }

        const data = await response.json().catch(() => null);
        console.log('[AI Service] Response data summary (JSON received)');

        // Flexible validation: if it's JSON and not an explicit error, it's a pass
        if (!data || data.error) {
          return { success: false, message: data?.error?.message || 'API returned an empty response or error field' };
        }

        return { success: true };
      } else {
        const data = isJson ? await response.json().catch(() => null) : null;
        const errorMsg = data?.error?.message || data?.message || `HTTP ${response.status}: ${response.statusText}`;
        console.error(`[AI Service] Test failed: ${errorMsg}`, data);
        return { success: false, message: errorMsg };
      }
    } catch (error) {
      console.error('[AI Service] Network error during test:', error);
      return { success: false, message: `Network Error: ${error.message}` };
    }
  }
};
