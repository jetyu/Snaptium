import { defineStore } from 'pinia';
import { ref } from 'vue';
import { createLogger } from '@renderer/features/logger';
import { getErrorMessage } from '@shared/utils/error.utils';
import {
  AI_WRITING_DEFAULTS,
  type AiWritingScenario,
  type AiWritingStyle,
  type AiWritingMode,
} from '@shared/ai.constants';
import {
  OFFICIAL_AI_MODELS,
  OFFICIAL_AI_SOURCE_IDS,
  getOfficialAiSources,
  isOfficialAiSourceId,
} from '@shared/official-ai.constants';
import { AI_PROVIDERS, type AiProvider } from '@shared/ai-provider.constants';

import { DEFAULT_KNOWLEDGE_COPILOT_CONFIG } from '@renderer/features/knowledge-copilot/constants/knowledge-copilot.constants';
import { DEFAULT_SYNC_SETTINGS, type SyncProvider } from '@shared/sync.constants';
import { DEFAULT_UPDATE_CHANNEL, type UpdateChannel } from '@shared/updater.constants';
import { UPDATER_CONSTANTS } from '@renderer/features/updater/constants/updater.constants';
import {
  APP_SHELL_MAX_CUSTOM_MODULES,
  APP_SHELL_DEFAULT_MAIN_VIEW,
  type AppShellMainViewId,
  type AppShellModuleId,
} from '@renderer/app/constants/appShell.constants';
import {
  createDefaultWorkbenchSettings,
  sanitizeWorkbenchSettings,
  type WorkbenchSettings,
} from '@renderer/features/workbench/constants/workbench.constants';
import { DEFAULT_TRUSTED_REMOTE_IMAGE_HOSTS, normalizeTrustedRemoteImageHosts } from '@shared/preview-security.constants';
import { settingsService } from '../services/settings.service';

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const numericValue = Number(value);
  const finiteValue = Number.isFinite(numericValue) ? numericValue : fallback;
  return Math.min(max, Math.max(min, finiteValue));
}

function clampInteger(value: unknown, fallback: number, min: number, max: number): number {
  return Math.trunc(clampNumber(value, fallback, min, max));
}

function normalizeKnowledgeCopilotNumber<K extends keyof KnowledgeCopilotSettings>(
  key: K,
  value: KnowledgeCopilotSettings[K],
): KnowledgeCopilotSettings[K] {
  if (key === 'chunkSize') {
    return clampInteger(value, 500, 500, 800) as KnowledgeCopilotSettings[K];
  }

  if (key === 'chunkOverlap') {
    return clampInteger(value, 50, 50, 100) as KnowledgeCopilotSettings[K];
  }

  if (key === 'topK') {
    return clampInteger(value, 5, 1, 10) as KnowledgeCopilotSettings[K];
  }

  if (key === 'similarityThreshold') {
    return clampNumber(value, 0.45, 0, 1) as KnowledgeCopilotSettings[K];
  }

  return value;
}

export interface AISource {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  aiModel: string;
  capabilities: string[];
  provider: AiProvider;
  official?: boolean;
  locked?: boolean;
}

export interface AIAssistantSettings {
  enabled: boolean;
  sourceId: string;
  model: string;
  triggerMode: AiWritingMode;
  autoContinue: boolean;
  writingStyle: AiWritingStyle;
  writingScenario: AiWritingScenario;
  systemPrompt: string;
}

export interface KnowledgeCopilotSettings {
  enabled: boolean;
  embeddingSourceId: string;
  embeddingModel: string;
  askChatSourceId: string;
  askChatModel: string;
  agentChatSourceId: string;
  agentChatModel: string;
  rerankerSourceId: string;
  rerankerModel: string;
  defaultMode: 'ask' | 'agent';
  agentExecutionMode: 'confirm' | 'auto';
  chunkSize: number;
  chunkOverlap: number;
  topK: number;
  similarityThreshold: number;
  autoIndex: boolean;
  indexOnSave: boolean;
  lastIndexedAt: number | null;
  indexSignatures: Record<string, string>;
  indexChunkCounts: Record<string, number>;
  cachedTotalChunks: number;
}

export interface WebDavSyncSettings {
  url: string;
  username: string;
  password: string;
}

export interface OssS3SyncSettings {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

export interface SyncSettings {
  enabled: boolean;
  provider: SyncProvider;
  intervalMinutes: number;
  autoSyncOnSave: boolean;
  remotePath: string;
  webdav: WebDavSyncSettings;
  ossS3: OssS3SyncSettings;
  lastSyncedAt: number | null;
}

export interface AppShellSettings {
  activeMainView: AppShellMainViewId;
  customSidebarModules: AppShellModuleId[];
  maxCustomSidebarModules: number;
}

export interface PreviewAppearanceSettings {
  allowHtml: boolean;
  allowInlineSvg: boolean;
  remoteImageMode: 'blocked' | 'trusted' | 'all';
  trustedRemoteImageHosts: string[];
  fontSize: number;
  fontFamily: string;
}

export type WindowCloseAction = 'minimize' | 'exit';
export type ThemeMode = 'system' | 'light' | 'dark';
export type AccentMode = 'black' | 'azureBlue' | 'indigo' | 'cyan' | 'teal';

export interface AppSettings {
  knowledgeCopilotSchemaVersion: number;
  language: string;
  autoStartup: boolean;
  windowCloseAction: WindowCloseAction;
  themeMode: ThemeMode;
  accentMode: AccentMode;
  previewAppearance: PreviewAppearanceSettings;
  editorFontSize: number;
  editorFont: string;
  showLineNumbers: boolean;
  wordWrap: boolean;
  codeFolding: boolean;
  highlightActiveLine: boolean;
  bracketMatching: boolean;
  autoCloseBrackets: boolean;
  autoIndent: boolean;
  showStatusBar: boolean;
  aiSources: AISource[];
  aiAssistant: AIAssistantSettings;
  knowledgeCopilot: KnowledgeCopilotSettings;
  sync: SyncSettings;
  loggingEnabled: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  logAutoClearDays: number;
  noteSavePath: string;
  autoCheckUpdates: boolean;
  updateCheckInterval: number;
  updateChannel: UpdateChannel;
  maxHistoryVersions: number;
  trashAutoClearDays: number;
  snapshotInterval: number;
  appShell: AppShellSettings;
  workbench: WorkbenchSettings;
  // ... future properties
}

function createDefaultSyncConfig(): SyncSettings {
  return {
    ...DEFAULT_SYNC_SETTINGS,
    webdav: { ...DEFAULT_SYNC_SETTINGS.webdav },
    ossS3: { ...DEFAULT_SYNC_SETTINGS.ossS3 },
  };
}

function createDefaultConfig(): AppSettings {
  return {
    knowledgeCopilotSchemaVersion: 1,
    language: 'en-US',
    autoStartup: false,
    windowCloseAction: 'minimize',
    themeMode: 'system',
    accentMode: 'azureBlue',
    previewAppearance: {
      allowHtml: true,
      allowInlineSvg: true,
      remoteImageMode: 'trusted',
      trustedRemoteImageHosts: [...DEFAULT_TRUSTED_REMOTE_IMAGE_HOSTS],
      fontSize: 16,
      fontFamily: '',
    },
    editorFontSize: 14,
    editorFont: '',
    showLineNumbers: true,
    wordWrap: true,
    codeFolding: false,
    highlightActiveLine: true,
    bracketMatching: true,
    autoCloseBrackets: true,
    autoIndent: true,
    showStatusBar: true,
    aiSources: getOfficialAiSources(),
    aiAssistant: {
      enabled: false,
      sourceId: OFFICIAL_AI_SOURCE_IDS.CHAT,
      model: OFFICIAL_AI_MODELS.CHAT,
      triggerMode: AI_WRITING_DEFAULTS.MODE,
      autoContinue: AI_WRITING_DEFAULTS.AUTO_CONTINUE,
      writingStyle: AI_WRITING_DEFAULTS.STYLE,
      writingScenario: AI_WRITING_DEFAULTS.SCENARIO,
      systemPrompt: '',
    },
    knowledgeCopilot: {
      ...DEFAULT_KNOWLEDGE_COPILOT_CONFIG,
      embeddingSourceId: OFFICIAL_AI_SOURCE_IDS.EMBEDDING,
      embeddingModel: OFFICIAL_AI_MODELS.EMBEDDING,
      askChatSourceId: OFFICIAL_AI_SOURCE_IDS.CHAT,
      askChatModel: OFFICIAL_AI_MODELS.CHAT,
      agentChatSourceId: OFFICIAL_AI_SOURCE_IDS.CHAT,
      agentChatModel: OFFICIAL_AI_MODELS.CHAT,
      rerankerSourceId: OFFICIAL_AI_SOURCE_IDS.RERANKER,
      rerankerModel: OFFICIAL_AI_MODELS.RERANKER,
    },
    sync: createDefaultSyncConfig(),
    loggingEnabled: false,
    logLevel: 'error',
    logAutoClearDays: 0,
    noteSavePath: '',
    autoCheckUpdates: true,
    updateCheckInterval: UPDATER_CONSTANTS.DEFAULT_CHECK_INTERVAL,
    updateChannel: DEFAULT_UPDATE_CHANNEL,
    maxHistoryVersions: 50,
    trashAutoClearDays: 30,
    snapshotInterval: 15,
    appShell: {
      activeMainView: APP_SHELL_DEFAULT_MAIN_VIEW,
      customSidebarModules: ['favorites', 'search', 'settings', 'trash'],
      maxCustomSidebarModules: APP_SHELL_MAX_CUSTOM_MODULES,
    },
    workbench: createDefaultWorkbenchSettings(),
  };
}

export const useSettingsStore = defineStore('settings', () => {
  const settingsLogger = createLogger('SettingsStore');
  const config = ref<AppSettings>(createDefaultConfig());

  const isLoading = ref(false);

  const sourceSupportsCapability = (source: AISource, capability: string): boolean => {
    return source.capabilities.length === 0 || source.capabilities.includes(capability);
  };

  const isLockedAiSource = (source: AISource): boolean => {
    return source.locked === true || source.official === true || isOfficialAiSourceId(source.id);
  };

  /**
   * Load settings from persistent storage (via IPC or LocalStorage)
   */
  const loadSettings = async () => {
    isLoading.value = true;
    try {
      config.value = await settingsService.loadConfig(createDefaultConfig());
    } catch (e) {
      settingsLogger.error(`Failed to load settings: ${e}`);
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Save settings to persistent storage
   */
  const saveSettings = async (newConfig: Partial<AppSettings>) => {
    config.value = {
      ...config.value,
      ...newConfig,
      aiAssistant: {
        ...config.value.aiAssistant,
        ...(newConfig.aiAssistant ?? {}),
      },
      previewAppearance: {
        ...config.value.previewAppearance,
        ...(newConfig.previewAppearance ?? {}),
        trustedRemoteImageHosts: Array.isArray(newConfig.previewAppearance?.trustedRemoteImageHosts)
          ? normalizeTrustedRemoteImageHosts(newConfig.previewAppearance.trustedRemoteImageHosts)
          : [...config.value.previewAppearance.trustedRemoteImageHosts],
      },
      knowledgeCopilot: {
        ...config.value.knowledgeCopilot,
        ...(newConfig.knowledgeCopilot ?? {}),
      },
      sync: {
        ...config.value.sync,
        ...(newConfig.sync ?? {}),
        webdav: {
          ...config.value.sync.webdav,
          ...(newConfig.sync?.webdav ?? {}),
        },
        ossS3: {
          ...config.value.sync.ossS3,
          ...(newConfig.sync?.ossS3 ?? {}),
        },
      },
      appShell: {
        ...config.value.appShell,
        ...(newConfig.appShell ?? {}),
        customSidebarModules: Array.isArray(newConfig.appShell?.customSidebarModules)
          ? [...newConfig.appShell.customSidebarModules]
          : [...config.value.appShell.customSidebarModules],
        maxCustomSidebarModules: APP_SHELL_MAX_CUSTOM_MODULES,
      },
      workbench: sanitizeWorkbenchSettings({
        ...config.value.workbench,
        ...(newConfig.workbench ?? {}),
      }),
    };
    try {
      config.value = await settingsService.saveConfig(config.value);
    } catch (e) {
      settingsLogger.error(`Failed to save settings: ${e}`);
    }
  };

  const setLanguage = async (language: string) => {
    const nextLanguage = await settingsService.changeLanguage(language);
    await saveSettings({ language: nextLanguage });
  };

  const setAutoStartup = async (enabled: boolean) => {
    try {
      const result = await settingsService.setStartup(enabled);
      await saveSettings({ autoStartup: result.enabled });
    } catch (e) {
      settingsLogger.error(`Failed to set auto startup: ${e}`);
    }
  };

  const setNoteSavePath = async (path: string) => {
    await saveSettings({ noteSavePath: path });
  };

  /**
   * Update a specific configuration property
   */
  const updateSetting = async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    if (key === 'language') {
      await setLanguage(String(value));
      return;
    }

    if (key === 'autoStartup') {
      await setAutoStartup(Boolean(value));
      return;
    }

    config.value[key] = value;
    await saveSettings({});
  };

  /**
   * Update assistant specific setting
   */
  const updateAssistantSetting = async <K extends keyof AIAssistantSettings>(
    key: K,
    value: AIAssistantSettings[K]
  ) => {
    config.value.aiAssistant[key] = value;

    // Auto-update model if sourceId changes
    if (key === 'sourceId') {
      const source = config.value.aiSources.find(s => s.id === String(value));
      if (source && source.aiModel) {
        config.value.aiAssistant.model = source.aiModel;
      }
    }

    await saveSettings({});
  };

  const updatePreviewAppearanceSetting = async <K extends keyof PreviewAppearanceSettings>(
    key: K,
    value: PreviewAppearanceSettings[K]
  ) => {
    config.value.previewAppearance[key] = value;
    await saveSettings({});
  };

  /**
   * Update knowledge-copilot specific setting
   */
  const updateKnowledgeCopilotSetting = async <K extends keyof KnowledgeCopilotSettings>(
    key: K,
    value: KnowledgeCopilotSettings[K]
  ) => {
    config.value.knowledgeCopilot[key] = normalizeKnowledgeCopilotNumber(key, value);

    // Auto-update model if sourceId changes
    if (key === 'embeddingSourceId') {
      const source = config.value.aiSources.find(s => s.id === String(value));
      if (source && source.aiModel) {
        config.value.knowledgeCopilot.embeddingModel = source.aiModel;
      }
    }
    if (key === 'askChatSourceId' || key === 'agentChatSourceId') {
      const source = config.value.aiSources.find(s => s.id === String(value));
      const modelKey = key === 'askChatSourceId' ? 'askChatModel' : 'agentChatModel';
      if (source && source.aiModel) {
        config.value.knowledgeCopilot[modelKey] = source.aiModel;
      } else if (value === '') {
        config.value.knowledgeCopilot[modelKey] = '';
      }
    }

    await saveSettings({});
  };

  const updateSyncSetting = async <K extends keyof SyncSettings>(
    key: K,
    value: SyncSettings[K]
  ) => {
    config.value.sync[key] = value;
    await saveSettings({});
  };

  const updateWebDavSyncSetting = async <K extends keyof WebDavSyncSettings>(
    key: K,
    value: WebDavSyncSettings[K]
  ) => {
    config.value.sync.webdav[key] = value;
    await saveSettings({});
  };

  const updateOssS3SyncSetting = async <K extends keyof OssS3SyncSettings>(
    key: K,
    value: OssS3SyncSettings[K]
  ) => {
    config.value.sync.ossS3[key] = value;
    await saveSettings({});
  };

  const updateSyncProviderSetting = async <
    Provider extends keyof Pick<SyncSettings, 'webdav' | 'ossS3'>,
    Key extends keyof SyncSettings[Provider]
  >(
    provider: Provider,
    key: Key,
    value: SyncSettings[Provider][Key]
  ) => {
    if (provider === 'webdav') {
      await updateWebDavSyncSetting(
        key as keyof WebDavSyncSettings,
        value as WebDavSyncSettings[keyof WebDavSyncSettings]
      );
    } else {
      await updateOssS3SyncSetting(
        key as keyof OssS3SyncSettings,
        value as OssS3SyncSettings[keyof OssS3SyncSettings]
      );
    }
  };

  const resetSyncProviderSetting = async (provider: 'webdav' | 'ossS3') => {
    const defaults = createDefaultSyncConfig();
    if (provider === 'webdav') {
      config.value.sync.webdav = { ...defaults.webdav };
    } else {
      config.value.sync.ossS3 = { ...defaults.ossS3 };
    }
    await saveSettings({});
  };

  /**
   * Add a new AI source
   */
  const addAiSource = async (source: Omit<AISource, 'id'>) => {
    const newSource = { ...source, id: Date.now().toString(), official: false, locked: false };
    config.value.aiSources.push(newSource);
    await saveSettings({});
    return newSource;
  };

  /**
   * Remove an AI source by ID
   */
  const removeAiSource = async (id: string) => {
    const source = config.value.aiSources.find((item) => item.id === id);
    if (source && isLockedAiSource(source)) {
      return;
    }

    config.value.aiSources = config.value.aiSources.filter((s) => s.id !== id);
    if (config.value.aiAssistant.sourceId === id) {
      config.value.aiAssistant.sourceId = '';
    }
    if (config.value.knowledgeCopilot.embeddingSourceId === id) {
      config.value.knowledgeCopilot.embeddingSourceId = '';
      config.value.knowledgeCopilot.embeddingModel = '';
    }
    if (config.value.knowledgeCopilot.askChatSourceId === id) {
      config.value.knowledgeCopilot.askChatSourceId = '';
      config.value.knowledgeCopilot.askChatModel = '';
    }
    if (config.value.knowledgeCopilot.agentChatSourceId === id) {
      config.value.knowledgeCopilot.agentChatSourceId = '';
      config.value.knowledgeCopilot.agentChatModel = '';
    }
    if (config.value.knowledgeCopilot.rerankerSourceId === id) {
      config.value.knowledgeCopilot.rerankerSourceId = '';
    }
    await saveSettings({});
  };

  /**
   * Update an existing AI source
   */
  const updateAiSource = async (id: string, updates: Partial<AISource>) => {
    const source = config.value.aiSources.find((s) => s.id === id);
    if (source) {
      if (isLockedAiSource(source)) {
        return;
      }

      Object.assign(source, updates);
      if (config.value.aiAssistant.sourceId === id && !sourceSupportsCapability(source, 'chat')) {
        config.value.aiAssistant.sourceId = '';
      }
      if (config.value.knowledgeCopilot.embeddingSourceId === id && !sourceSupportsCapability(source, 'embedding')) {
        config.value.knowledgeCopilot.embeddingSourceId = '';
        config.value.knowledgeCopilot.embeddingModel = '';
      }
      if (config.value.knowledgeCopilot.askChatSourceId === id && !sourceSupportsCapability(source, 'chat')) {
        config.value.knowledgeCopilot.askChatSourceId = '';
        config.value.knowledgeCopilot.askChatModel = '';
      }
      if (config.value.knowledgeCopilot.agentChatSourceId === id && !sourceSupportsCapability(source, 'chat')) {
        config.value.knowledgeCopilot.agentChatSourceId = '';
        config.value.knowledgeCopilot.agentChatModel = '';
      }
      if (config.value.knowledgeCopilot.rerankerSourceId === id && !sourceSupportsCapability(source, 'reranker')) {
        config.value.knowledgeCopilot.rerankerSourceId = '';
      }
      await saveSettings({});
    }
  };

  /**
   * Test AI connection with provided or saved config
   */
  const testConnection = async (testConfig?: {
    provider: AiProvider;
    aiBaseUrl: string;
    aiApiKey: string;
    aiModel: string;
    capabilities: string[];
  }): Promise<{ success: boolean; message?: string }> => {
    try {
      const payload = testConfig || {
        provider: AI_PROVIDERS.OPENAI_COMPATIBLE,
        aiBaseUrl: '',
        aiApiKey: '',
        aiModel: config.value.aiAssistant.model,
        capabilities: ['chat'],
      };

      // If no config provided, try to find the linked source
      if (!testConfig && config.value.aiAssistant.sourceId) {
        const source = config.value.aiSources.find((s) => s.id === config.value.aiAssistant.sourceId);
        if (source) {
          payload.aiBaseUrl = source.baseUrl;
          payload.provider = source.provider;
          payload.aiApiKey = source.apiKey;
          payload.capabilities = [...source.capabilities];
        }
      }

      return await settingsService.testConnection(config.value, payload);
    } catch (e) {
      settingsLogger.error(`Failed to test AI connection: ${e}`);
      return { success: false, message: getErrorMessage(e) };
    }
  };

  const openLogDir = (): Promise<boolean | undefined> => settingsService.openLogDir();

  const exportSettings = (): Promise<boolean> => settingsService.exportConfig();

  const importSettings = async (): Promise<boolean> => {
    try {
      const importedConfig = await settingsService.importConfig(createDefaultConfig());
      if (!importedConfig) {
        return false;
      }

      config.value = importedConfig;
      return true;
    } catch (e) {
      settingsLogger.error(`Failed to import settings: ${e}`);
      return false;
    }
  };

  const resetSettings = async (): Promise<boolean> => {
    try {
      const resetConfig = await settingsService.resetConfig(createDefaultConfig());
      if (!resetConfig) {
        return false;
      }

      config.value = resetConfig;
      return true;
    } catch (e) {
      settingsLogger.error(`Failed to reset settings: ${e}`);
      return false;
    }
  };

  return {
    config,
    isLoading,
    loadSettings,
    saveSettings,
    setLanguage,
    setAutoStartup,
    updateSetting,
    updateAssistantSetting,
    updatePreviewAppearanceSetting,
    updateKnowledgeCopilotSetting,
    updateSyncSetting,
    updateSyncProviderSetting,
    addAiSource,
    removeAiSource,
    updateAiSource,
    testConnection,
    openLogDir,
    exportSettings,
    importSettings,
    resetSettings,
    setNoteSavePath,
    resetSyncProviderSetting,
  };
});
