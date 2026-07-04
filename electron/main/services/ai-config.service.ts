import { settingsService } from './settings.service.js';
import { $t } from '../utils/i18n.js';
import {
  AI_WRITING_DEFAULTS,
  type AiWritingScenario,
  type AiWritingStyle,
  isValidAiWritingScenario,
  isValidAiWritingStyle,
} from '../../shared/ai.constants.js';
import { LICENSE_FEATURES, type LicensedFeature } from '../../shared/license.constants.js';
import {
  OFFICIAL_AI_BASE_URL,
  OFFICIAL_AI_MODELS,
  OFFICIAL_AI_SOURCE_IDS,
  isOfficialAiSourceId,
} from '../../shared/official-ai.constants.js';
import { licenseService } from './license.service.js';

interface AiSourceConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  aiModel: string;
  capabilities: string[];
  official: boolean;
  locked: boolean;
}

interface AiAssistantSettings {
  enabled: boolean;
  sourceId: string;
  model: string;
  systemPrompt: string;
  writingStyle: unknown;
  writingScenario: unknown;
}

interface RagSettings {
  enabled: boolean;
  embeddingSourceId: string;
  embeddingModel: string;
  ragChatSourceId: string;
  ragChatModel: string;
  rerankerSourceId: string;
  topK: number;
  similarityThreshold: number;
}

interface NormalizedAppConfig {
  language: string;
  noteSavePath: string;
  aiSources: AiSourceConfig[];
  aiAssistant: AiAssistantSettings;
  rag: RagSettings;
}

interface ResolvedEmbeddingConfig {
  endpoint: string;
  apiKey: string;
  model: string;
}

interface ResolvedChatConfig {
  endpoint: string;
  apiKey: string;
  model: string;
}

interface ResolvedRerankerConfig {
  sourceId: string;
  endpoint: string;
  apiKey: string;
  model: string;
}

interface ResolvedAssistantConfig {
  endpoint: string;
  apiKey: string;
  model: string;
  uiLanguage: string;
  customSystemPrompt: string;
  writingStyle: AiWritingStyle;
  writingScenario: AiWritingScenario;
}

interface ResolvedRagConfig {
  uiLanguage: string;
  workspaceRoot: string;
  rag: Pick<RagSettings, 'topK' | 'similarityThreshold'>;
  embeddingConfig: ResolvedEmbeddingConfig;
  chatConfig: ResolvedChatConfig | null;
  rerankerConfig: ResolvedRerankerConfig | null;
}

type UnknownRecord = Record<string, unknown>;
type LoadedAppConfig = Awaited<ReturnType<typeof settingsService.loadConfig>>;

function toRecord(value: unknown): UnknownRecord {
  return typeof value === 'object' && value !== null
    ? (value as UnknownRecord)
    : {};
}

function toText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toBoolean(value: unknown): boolean {
  return value === true;
}

function toFiniteNumber(value: unknown, fallback: number): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function normalizeSimilarityThreshold(value: unknown): number {
  const threshold = toFiniteNumber(value, 0.45);
  return Math.min(1, Math.max(0, threshold));
}

function normalizeTopK(value: unknown): number {
  const topK = Math.floor(toFiniteNumber(value, 5));
  return topK > 0 ? topK : 5;
}

function normalizeAiSource(item: unknown): AiSourceConfig {
  const record = toRecord(item);
  const id = toText(record.id);
  const capabilities = Array.isArray(record.capabilities)
    ? record.capabilities
      .filter((capability): capability is string => typeof capability === 'string' && capability.trim().length > 0)
      .map((capability) => capability.trim())
    : [];

  return {
    id,
    name: toText(record.name),
    baseUrl: toText(record.baseUrl),
    apiKey: toText(record.apiKey),
    aiModel: toText(record.aiModel),
    capabilities,
    official: record.official === true || isOfficialAiSourceId(id),
    locked: record.locked === true || isOfficialAiSourceId(id),
  };
}

function normalizeAiSources(aiSources: unknown): AiSourceConfig[] {
  if (!Array.isArray(aiSources)) {
    return [];
  }

  return aiSources
    .map((source) => normalizeAiSource(source))
    .filter((source) => source.id.length > 0);
}

function normalizeAiAssistant(aiAssistant: unknown): AiAssistantSettings {
  const record = toRecord(aiAssistant);
  return {
    enabled: toBoolean(record.enabled),
    sourceId: toText(record.sourceId),
    model: toText(record.model),
    systemPrompt: typeof record.systemPrompt === 'string' ? record.systemPrompt : '',
    writingStyle: record.writingStyle,
    writingScenario: record.writingScenario,
  };
}

function normalizeRagSettings(rag: unknown): RagSettings {
  const record = toRecord(rag);
  return {
    enabled: toBoolean(record.enabled),
    embeddingSourceId: toText(record.embeddingSourceId),
    embeddingModel: toText(record.embeddingModel),
    ragChatSourceId: toText(record.ragChatSourceId),
    ragChatModel: toText(record.ragChatModel),
    rerankerSourceId: toText(record.rerankerSourceId),
    topK: normalizeTopK(record.topK),
    similarityThreshold: normalizeSimilarityThreshold(record.similarityThreshold),
  };
}

function normalizeAppConfig(config: LoadedAppConfig): NormalizedAppConfig {
  return {
    language: toText(config.language),
    noteSavePath: toText(config.noteSavePath),
    aiSources: normalizeAiSources(config.aiSources),
    aiAssistant: normalizeAiAssistant(config.aiAssistant),
    rag: normalizeRagSettings(config.rag),
  };
}

function requireConfiguredSource(
  aiSources: AiSourceConfig[],
  sourceId: string,
  errorMessage: string,
): AiSourceConfig {
  if (!sourceId) {
    throw new Error(errorMessage);
  }

  const source = aiSources.find((item) => item.id === sourceId);
  if (!source) {
    throw new Error(errorMessage);
  }

  return source;
}

function resolveModel(preferredModel: string, fallbackModel: string, errorMessage: string): string {
  const model = preferredModel || fallbackModel || '';
  if (!model) {
    throw new Error(errorMessage);
  }
  return model;
}

function resolveAssistantPromptSettings(aiAssistant: AiAssistantSettings): {
  customSystemPrompt: string;
  writingStyle: AiWritingStyle;
  writingScenario: AiWritingScenario;
} {
  const customSystemPrompt = aiAssistant.systemPrompt.trim();
  const writingStyleCandidate = aiAssistant.writingStyle;
  const writingScenarioCandidate = aiAssistant.writingScenario;
  const writingStyle = isValidAiWritingStyle(writingStyleCandidate)
    ? writingStyleCandidate
    : AI_WRITING_DEFAULTS.STYLE;
  const writingScenario = isValidAiWritingScenario(writingScenarioCandidate)
    ? writingScenarioCandidate
    : AI_WRITING_DEFAULTS.SCENARIO;

  return {
    customSystemPrompt,
    writingStyle,
    writingScenario,
  };
}

function supportsCapability(source: AiSourceConfig, capability: string): boolean {
  return source.capabilities.length === 0 || source.capabilities.includes(capability);
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

function resolveSourceEndpoint(source: AiSourceConfig, capability: 'chat' | 'embedding' | 'reranker'): string {
  const baseUrl = normalizeBaseUrl(source.official ? OFFICIAL_AI_BASE_URL : source.baseUrl);
  if (!baseUrl) {
    throw new Error(`Missing ${capability} base URL`);
  }

  if (capability === 'chat') {
    return `${baseUrl}/chat/completions`;
  }

  if (capability === 'embedding') {
    return `${baseUrl}/embeddings`;
  }

  return `${baseUrl}/rerank`;
}

function resolveOfficialModel(source: AiSourceConfig, capability: 'chat' | 'embedding' | 'reranker'): string | null {
  if (!source.official) {
    return null;
  }

  if (capability === 'chat' && source.id === OFFICIAL_AI_SOURCE_IDS.CHAT) {
    return OFFICIAL_AI_MODELS.CHAT;
  }

  if (capability === 'embedding' && source.id === OFFICIAL_AI_SOURCE_IDS.EMBEDDING) {
    return OFFICIAL_AI_MODELS.EMBEDDING;
  }

  if (capability === 'reranker' && source.id === OFFICIAL_AI_SOURCE_IDS.RERANKER) {
    return OFFICIAL_AI_MODELS.RERANKER;
  }

  return source.aiModel;
}

async function resolveSourceApiKey(source: AiSourceConfig, feature: LicensedFeature): Promise<string> {
  if (source.official) {
    return await licenseService.getAccessTokenForFeature(feature);
  }

  return source.apiKey;
}

function requireConfiguredSourceWithCapability(
  aiSources: AiSourceConfig[],
  sourceId: string,
  capability: string,
  errorMessage: string,
): AiSourceConfig {
  const source = requireConfiguredSource(aiSources, sourceId, errorMessage);
  if (!supportsCapability(source, capability)) {
    throw new Error(errorMessage);
  }

  return source;
}

export const aiConfigService = {
  async loadAppConfig(): Promise<NormalizedAppConfig> {
    const config = await settingsService.loadConfig();
    return normalizeAppConfig(config);
  },

  async resolveAssistantConfig(): Promise<ResolvedAssistantConfig> {
    const config = await this.loadAppConfig();
    const aiAssistant = config.aiAssistant;
    const promptSettings = resolveAssistantPromptSettings(aiAssistant);

    if (!aiAssistant.enabled) {
      throw new Error($t('aiAssistant.error.disabled', 'AI Assistant is disabled'));
    }

    const source = requireConfiguredSourceWithCapability(
      config.aiSources,
      aiAssistant.sourceId,
      'chat',
      $t('aiAssistant.error.sourceNotFound', 'AI source not found'),
    );
    const model = resolveOfficialModel(source, 'chat') ?? resolveModel(
      aiAssistant.model,
      source.aiModel,
      $t('aiAssistant.error.noModelConfigured', 'No model configured'),
    );

    return {
      endpoint: resolveSourceEndpoint(source, 'chat'),
      apiKey: await resolveSourceApiKey(source, LICENSE_FEATURES.AI_ASSISTANT),
      model,
      uiLanguage: config.language,
      customSystemPrompt: promptSettings.customSystemPrompt,
      writingStyle: promptSettings.writingStyle,
      writingScenario: promptSettings.writingScenario,
    };
  },

  async resolveRagConfig(): Promise<ResolvedRagConfig> {
    const config = await this.loadAppConfig();
    const rag = config.rag;

    if (!rag.enabled) {
      throw new Error('RAG is disabled in settings');
    }

    if (!config.noteSavePath) {
      throw new Error('No workspace root configured');
    }

    const embeddingSource = requireConfiguredSourceWithCapability(
      config.aiSources,
      rag.embeddingSourceId,
      'embedding',
      'Embedding source not found',
    );

    const ragChatSource = rag.ragChatSourceId
      ? config.aiSources.find((item) => item.id === rag.ragChatSourceId && supportsCapability(item, 'chat')) ?? null
      : null;

    const rerankerSource = rag.rerankerSourceId
      ? config.aiSources.find((item) => item.id === rag.rerankerSourceId && supportsCapability(item, 'reranker')) ?? null
      : null;
    const embeddingApiKey = await resolveSourceApiKey(embeddingSource, LICENSE_FEATURES.RAG);
    const ragChatApiKey = ragChatSource
      ? await resolveSourceApiKey(ragChatSource, LICENSE_FEATURES.RAG)
      : null;
    const rerankerApiKey = rerankerSource
      ? await resolveSourceApiKey(rerankerSource, LICENSE_FEATURES.RAG)
      : null;

    return {
      uiLanguage: config.language,
      workspaceRoot: config.noteSavePath,
      rag: {
        topK: rag.topK,
        similarityThreshold: rag.similarityThreshold,
      },
      embeddingConfig: {
        endpoint: resolveSourceEndpoint(embeddingSource, 'embedding'),
        apiKey: embeddingApiKey,
        model: resolveOfficialModel(embeddingSource, 'embedding')
          ?? resolveModel(rag.embeddingModel, embeddingSource.aiModel, 'Embedding model not specified'),
      },
      chatConfig: ragChatSource
        ? {
            endpoint: resolveSourceEndpoint(ragChatSource, 'chat'),
            apiKey: ragChatApiKey ?? '',
            model: resolveOfficialModel(ragChatSource, 'chat')
              ?? resolveModel(rag.ragChatModel, ragChatSource.aiModel, 'No chat model configured'),
          }
        : null,
      rerankerConfig: rerankerSource
        ? {
            sourceId: rerankerSource.id,
            endpoint: resolveSourceEndpoint(rerankerSource, 'reranker'),
            apiKey: rerankerApiKey ?? '',
            model: resolveOfficialModel(rerankerSource, 'reranker')
              ?? resolveModel('', rerankerSource.aiModel, 'No reranker model configured'),
          }
        : null,
    };
  },
};
