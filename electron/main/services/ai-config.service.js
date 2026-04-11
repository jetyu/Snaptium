import { settingsService } from './settings.service.js';
import { $t } from '../utils/i18n.js';

function requireConfiguredSource(aiSources, sourceId, errorMessage) {
  if (!sourceId) {
    throw new Error(errorMessage);
  }

  const source = aiSources.find((item) => item.id === sourceId);
  if (!source) {
    throw new Error(errorMessage);
  }

  return source;
}

function resolveModel(preferredModel, fallbackModel, errorMessage) {
  const model = preferredModel || fallbackModel || '';
  if (!model) {
    throw new Error(errorMessage);
  }
  return model;
}

export const aiConfigService = {
  async loadAppConfig() {
    return await settingsService.loadConfig();
  },

  async resolveAssistantConfig() {
    const config = await this.loadAppConfig();
    const aiAssistant = config.aiAssistant || {};

    if (!aiAssistant.enabled) {
      throw new Error($t('aiAssistant.error.disabled', 'AI Assistant is disabled'));
    }

    const aiSources = config.aiSources || [];
    const source = requireConfiguredSource(
      aiSources,
      aiAssistant.sourceId,
      $t('aiAssistant.error.sourceNotFound', 'AI source not found')
    );

    return {
      endpoint: source.endpoint,
      apiKey: source.apiKey,
      model: resolveModel(
        aiAssistant.model,
        source.aiModel,
        $t('aiAssistant.error.noModelConfigured', 'No model configured')
      ),
      systemPrompt: (aiAssistant.systemPrompt || '').trim() || $t('ai.prompt.autoComplete'),
    };
  },

  async resolveRagConfig() {
    const config = await this.loadAppConfig();
    const rag = config.rag || {};

    if (!rag.enabled) {
      throw new Error('RAG is disabled in settings');
    }

    if (!config.noteSavePath) {
      throw new Error('No workspace root configured');
    }

    const aiSources = config.aiSources || [];
    const embeddingSource = requireConfiguredSource(
      aiSources,
      rag.embeddingSourceId,
      'Embedding source not found'
    );

    const ragChatSource = rag.ragChatSourceId
      ? aiSources.find((item) => item.id === rag.ragChatSourceId) || null
      : null;

    return {
      workspaceRoot: config.noteSavePath,
      rag,
      embeddingConfig: {
        endpoint: embeddingSource.endpoint,
        apiKey: embeddingSource.apiKey,
        model: resolveModel(rag.embeddingModel, embeddingSource.aiModel, 'Embedding model not specified'),
      },
      chatConfig: ragChatSource
        ? {
            endpoint: ragChatSource.endpoint,
            apiKey: ragChatSource.apiKey,
            model: resolveModel(rag.ragChatModel, ragChatSource.aiModel, 'No chat model configured'),
          }
        : null,
    };
  },
};