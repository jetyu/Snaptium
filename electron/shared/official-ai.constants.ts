export const OFFICIAL_AI_BASE_URL = 'https://api.snaptium.com/v1/ai';

export const AI_CAPABILITIES = {
  CHAT: 'chat',
  EMBEDDING: 'embedding',
  RERANKER: 'reranker',
} as const satisfies Record<string, string>;

export type AiCapability = (typeof AI_CAPABILITIES)[keyof typeof AI_CAPABILITIES];

export const OFFICIAL_AI_MODELS = {
  CHAT: 'Chat',
  EMBEDDING: 'Embedding',
  RERANKER: 'Reranker',
} as const satisfies Record<string, string>;

export const OFFICIAL_AI_SOURCE_IDS = {
  CHAT: 'snaptium-official-chat',
  EMBEDDING: 'snaptium-official-embedding',
  RERANKER: 'snaptium-official-reranker',
} as const satisfies Record<string, string>;

export type OfficialAiSourceId = (typeof OFFICIAL_AI_SOURCE_IDS)[keyof typeof OFFICIAL_AI_SOURCE_IDS];

export interface OfficialAiSource {
  id: OfficialAiSourceId;
  name: string;
  baseUrl: string;
  apiKey: string;
  aiModel: string;
  capabilities: AiCapability[];
  official: true;
  locked: true;
}

export const OFFICIAL_AI_SOURCES = [
  {
    id: OFFICIAL_AI_SOURCE_IDS.CHAT,
    name: 'Chat',
    baseUrl: OFFICIAL_AI_BASE_URL,
    apiKey: '',
    aiModel: OFFICIAL_AI_MODELS.CHAT,
    capabilities: [AI_CAPABILITIES.CHAT],
    official: true,
    locked: true,
  },
  {
    id: OFFICIAL_AI_SOURCE_IDS.EMBEDDING,
    name: 'Embedding',
    baseUrl: OFFICIAL_AI_BASE_URL,
    apiKey: '',
    aiModel: OFFICIAL_AI_MODELS.EMBEDDING,
    capabilities: [AI_CAPABILITIES.EMBEDDING],
    official: true,
    locked: true,
  },
  {
    id: OFFICIAL_AI_SOURCE_IDS.RERANKER,
    name: 'Reranker',
    baseUrl: OFFICIAL_AI_BASE_URL,
    apiKey: '',
    aiModel: OFFICIAL_AI_MODELS.RERANKER,
    capabilities: [AI_CAPABILITIES.RERANKER],
    official: true,
    locked: true,
  },
] as const satisfies readonly OfficialAiSource[];

const OFFICIAL_AI_SOURCE_ID_SET = new Set<string>(Object.values(OFFICIAL_AI_SOURCE_IDS));

export function isOfficialAiSourceId(value: string): value is OfficialAiSourceId {
  return OFFICIAL_AI_SOURCE_ID_SET.has(value);
}

export function isOfficialAiCapability(value: string): value is AiCapability {
  return Object.values(AI_CAPABILITIES).includes(value as AiCapability);
}

export function getOfficialAiSource(capability: AiCapability): OfficialAiSource {
  const source = OFFICIAL_AI_SOURCES.find((item) => item.capabilities.some((value) => value === capability));
  if (!source) {
    throw new Error(`Official AI source not found for ${capability}`);
  }

  return { ...source, capabilities: [...source.capabilities] };
}

export function getOfficialAiSources(): OfficialAiSource[] {
  return OFFICIAL_AI_SOURCES.map((source) => ({
    ...source,
    capabilities: [...source.capabilities],
  }));
}
