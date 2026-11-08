import { defineStore } from 'pinia';
import { ref } from 'vue';
import { createLogger } from '@renderer/features/logger';
import { getErrorMessage } from '@shared/utils/error.utils';
import {
  AI_TRANSLATION_DEFAULT_TARGET,
  AI_WRITING_DEFAULTS,
  type AiTranslationTargetLanguage,
  type AiWritingScenario,
  type AiWritingStyle,
  type AiWritingMode,
} from '@shared/ai.constants';
import {
  AI_PROVIDERS,
  resolveAiSourceModel,
  type AiCapability,
  type AiCapabilityModelMap,
  type AiProvider,
} from '@shared/ai-provider.constants';
import { BUILT_IN_AI_MODELS, BUILT_IN_AI_SOURCE_ID, isBuiltInAiSourceId } from '@shared/built-in-ai.constants';
import { normalizeKnowledgeCopilotRebuildConcurrency } from '@shared/knowledge-copilot.constants';

import { DEFAULT_KNOWLEDGE_COPILOT_CONFIG } from '@renderer/features/knowledge-copilot/constants/knowledge-copilot.constants';
import { DEFAULT_SYNC_SETTINGS, type SyncProvider } from '@shared/sync.constants';
import {
  DEFAULT_SCHEDULED_BACKUP_CONFIG,
  type ScheduledBackupConfig,
} from '@shared/scheduled-backup.constants';
import { DEFAULT_UPDATE_CHANNEL, type UpdateChannel } from '@shared/updater.constants';
import {
  DIAGNOSTIC_EXPORT_STATUS,
  type DiagnosticLogExportResult,
} from '@shared/diagnostic-log.constants';
import type { AccessControlConfig } from '@renderer/core/bridge/electronApi';
import { UPDATER_CONSTANTS } from '@renderer/features/updater/constants/updater.constants';
import {
  APP_SHELL_MAX_CUSTOM_MODULES,
  APP_SHELL_DEFAULT_MAIN_VIEW,
  type AppShellMainViewId,
  type AppShellModuleId,
} from '@renderer/app/constants/appShell.constants';
import {
  createDefaultWorkbenchSettings,
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
  embeddingProvider?: AiProvider,
): KnowledgeCopilotSettings[K] {
  if (key === 'chunkSize') {
    return clampInteger(value, 500, 500, 800) as KnowledgeCopilotSettings[K];
  }

  if (key === 'chunkOverlap') {
    return clampInteger(value, 50, 50, 100) as KnowledgeCopilotSettings[K];
  }

  if (key === 'rebuildConcurrency') {
    return normalizeKnowledgeCopilotRebuildConcurrency(value, embeddingProvider) as KnowledgeCopilotSettings[K];
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
  capabilityModels?: AiCapabilityModelMap;
  capabilities: string[];
  provider: AiProvider;
}

export interface AIAssistantSettings {
  enabled: boolean;
  sourceId: string;
  model: string;
  triggerMode: AiWritingMode;
  autoContinue: boolean;
  writingStyle: AiWritingStyle;
  writingScenario: AiWritingScenario;
  quickTranslationTarget: AiTranslationTargetLanguage;
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
  rebuildConcurrency: number;
  topK: number;
  similarityThreshold: number;
  autoIndex: boolean;
  indexOnSave: boolean;
  lastIndexedAt: number | null;
  lastRebuildDurationMs: number | null;
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

export interface PreviewConfig {
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

export interface GeneralConfig {
  language: string;
  autoStartup: boolean;
  windowCloseAction: WindowCloseAction;
  themeMode: ThemeMode;
  accentMode: AccentMode;
  appUIFont: string;
}

export interface EditorConfig {
  fontSize: number;
  fontFamily: string;
  showLineNumbers: boolean;
  wordWrap: boolean;
  codeFolding: boolean;
  highlightActiveLine: boolean;
  bracketMatching: boolean;
  autoCloseBrackets: boolean;
  autoIndent: boolean;
  showStatusBar: boolean;
}

export interface AiSourcesConfig {
  sources: AISource[];
}

export interface NoteStorageConfig {
  path: string;
  maxHistoryVersions: number;
  trashAutoClearDays: number;
  snapshotInterval: number;
  scheduledBackup: ScheduledBackupConfig;
}

export interface PrivacyLogConfig {
  enabled: boolean;
  level: 'debug' | 'info' | 'warn' | 'error';
  autoClearDays: number;
}

export interface SoftwareUpdateConfig {
  autoCheck: boolean;
  checkInterval: number;
  channel: UpdateChannel;
}

export interface AppSettings {
  general: GeneralConfig;
  preview: PreviewConfig;
  editor: EditorConfig;
  aiSources: AiSourcesConfig;
  aiAssistant: AIAssistantSettings;
  knowledgeCopilot: KnowledgeCopilotSettings;
  sync: SyncSettings;
  noteStorage: NoteStorageConfig;
  privacyLog: PrivacyLogConfig;
  softwareUpdate: SoftwareUpdateConfig;
  appShell: AppShellSettings;
  workbench: WorkbenchSettings;
  accessControl: AccessControlConfig;
}

function createDefaultGeneralConfig(): GeneralConfig {
  return {
    language: 'en-US',
    autoStartup: false,
    windowCloseAction: 'minimize',
    themeMode: 'system',
    accentMode: 'azureBlue',
    appUIFont: '',
  };
}

function createDefaultPreviewConfig(): PreviewConfig {
  return {
    allowHtml: true,
    allowInlineSvg: true,
    remoteImageMode: 'trusted',
    trustedRemoteImageHosts: [...DEFAULT_TRUSTED_REMOTE_IMAGE_HOSTS],
    fontSize: 16,
    fontFamily: '',
  };
}

function createDefaultEditorConfig(): EditorConfig {
  return {
    fontSize: 14,
    fontFamily: '',
    showLineNumbers: true,
    wordWrap: true,
    codeFolding: false,
    highlightActiveLine: true,
    bracketMatching: true,
    autoCloseBrackets: true,
    autoIndent: true,
    showStatusBar: true,
  };
}

function createDefaultAiSourcesConfig(): AiSourcesConfig {
  return {
    sources: [],
  };
}

function createDefaultAiAssistantConfig(): AIAssistantSettings {
  return {
    enabled: false,
    sourceId: '',
    model: '',
    triggerMode: AI_WRITING_DEFAULTS.MODE,
    autoContinue: AI_WRITING_DEFAULTS.AUTO_CONTINUE,
    writingStyle: AI_WRITING_DEFAULTS.STYLE,
    writingScenario: AI_WRITING_DEFAULTS.SCENARIO,
    quickTranslationTarget: AI_TRANSLATION_DEFAULT_TARGET,
    systemPrompt: '',
  };
}

function createDefaultKnowledgeCopilotConfig(): KnowledgeCopilotSettings {
  return {
    ...DEFAULT_KNOWLEDGE_COPILOT_CONFIG,
    embeddingSourceId: '',
    embeddingModel: '',
    rerankerSourceId: '',
    rerankerModel: '',
  };
}

function createDefaultSyncConfig(): SyncSettings {
  return {
    ...DEFAULT_SYNC_SETTINGS,
    webdav: { ...DEFAULT_SYNC_SETTINGS.webdav },
    ossS3: { ...DEFAULT_SYNC_SETTINGS.ossS3 },
  };
}

function createDefaultNoteStorageConfig(): NoteStorageConfig {
  return {
    path: '',
    maxHistoryVersions: 50,
    trashAutoClearDays: 30,
    snapshotInterval: 10,
    scheduledBackup: { ...DEFAULT_SCHEDULED_BACKUP_CONFIG },
  };
}

function createDefaultPrivacyLogConfig(): PrivacyLogConfig {
  return {
    enabled: false,
    level: 'error',
    autoClearDays: 10,
  };
}

function createDefaultSoftwareUpdateConfig(): SoftwareUpdateConfig {
  return {
    autoCheck: true,
    checkInterval: UPDATER_CONSTANTS.DEFAULT_CHECK_INTERVAL,
    channel: DEFAULT_UPDATE_CHANNEL,
  };
}

function createDefaultAppShellConfig(): AppShellSettings {
  return {
    activeMainView: APP_SHELL_DEFAULT_MAIN_VIEW,
    customSidebarModules: ['favorites', 'search', 'settings', 'trash'],
    maxCustomSidebarModules: APP_SHELL_MAX_CUSTOM_MODULES,
  };
}

function createDefaultAccessControlConfig(): AccessControlConfig {
  return {
    enabled: false,
    lockOnStartup: false,
    autoLockTimeoutMinutes: 0,
  };
}

function createDefaultConfig(): AppSettings {
  return {
    general: createDefaultGeneralConfig(),
    preview: createDefaultPreviewConfig(),
    editor: createDefaultEditorConfig(),
    aiSources: createDefaultAiSourcesConfig(),
    aiAssistant: createDefaultAiAssistantConfig(),
    knowledgeCopilot: createDefaultKnowledgeCopilotConfig(),
    sync: createDefaultSyncConfig(),
    noteStorage: createDefaultNoteStorageConfig(),
    privacyLog: createDefaultPrivacyLogConfig(),
    softwareUpdate: createDefaultSoftwareUpdateConfig(),
    appShell: createDefaultAppShellConfig(),
    workbench: createDefaultWorkbenchSettings(),
    accessControl: createDefaultAccessControlConfig(),
  };
}

export const useSettingsStore = defineStore('settings', () => {
  const settingsLogger = createLogger('SettingsStore');
  const config = ref<AppSettings>(createDefaultConfig());
  const scheduledBackupError = ref<string | null>(null);
  const scheduledBackupRunning = ref(false);
  const scheduledBackupRetryRequest = ref(0);

  const isLoading = ref(false);
  const isExportingDiagnosticLogs = ref(false);

  const sourceSupportsCapability = (source: AISource, capability: AiCapability): boolean => {
    return source.capabilities.length === 0 || source.capabilities.includes(capability);
  };

  /**
   * Load settings from persistent storage (via IPC or LocalStorage)
   */
  const loadSettings = async () => {
    isLoading.value = true;
    try {
      config.value = await settingsService.loadConfig();
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
    };
    try {
      config.value = await settingsService.saveConfig(config.value);
    } catch (e) {
      settingsLogger.error(`Failed to save settings: ${e}`);
    }
  };

  const setLanguage = async (language: string) => {
    const nextLanguage = await settingsService.changeLanguage(language);
    config.value.general.language = nextLanguage;
    await saveSettings({});
  };

  const setAutoStartup = async (enabled: boolean) => {
    try {
      const result = await settingsService.setStartup(enabled);
      config.value.general.autoStartup = result.enabled;
      await saveSettings({});
    } catch (e) {
      settingsLogger.error(`Failed to set auto startup: ${e}`);
    }
  };

  const setnoteStoragePath = async (path: string) => {
    config.value.noteStorage.path = path;
    await saveSettings({});
  };

  /**
   * Update a specific configuration property
   */
  const updateSetting = async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    config.value[key] = value;
    await saveSettings({});
  };

  const updateGeneralSetting = async <K extends keyof GeneralConfig>(key: K, value: GeneralConfig[K]) => {
    config.value.general[key] = value;
    await saveSettings({});
  };

  const updateEditorSetting = async <K extends keyof EditorConfig>(key: K, value: EditorConfig[K]) => {
    config.value.editor[key] = value;
    await saveSettings({});
  };

  const updateNoteStorageSetting = async <K extends keyof NoteStorageConfig>(
    key: K,
    value: NoteStorageConfig[K],
  ) => {
    config.value.noteStorage[key] = value;
    await saveSettings({});
  };

  const updateScheduledBackupSetting = async (
    updates: Partial<ScheduledBackupConfig>,
  ): Promise<void> => {
    config.value.noteStorage.scheduledBackup = {
      ...config.value.noteStorage.scheduledBackup,
      ...updates,
    };
    await saveSettings({});
  };

  const updatePrivacyLogSetting = async <K extends keyof PrivacyLogConfig>(
    key: K,
    value: PrivacyLogConfig[K],
  ) => {
    config.value.privacyLog[key] = value;
    await saveSettings({});
  };

  const updateSoftwareUpdateSetting = async <K extends keyof SoftwareUpdateConfig>(
    key: K,
    value: SoftwareUpdateConfig[K],
  ) => {
    config.value.softwareUpdate[key] = value;
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
      const source = config.value.aiSources.sources.find(s => s.id === String(value));
      config.value.aiAssistant.model = source ? resolveAiSourceModel(source, 'chat') : '';
    }

    await saveSettings({});
  };

  const updatePreviewSetting = async <K extends keyof PreviewConfig>(
    key: K,
    value: PreviewConfig[K]
  ) => {
    config.value.preview[key] = key === 'trustedRemoteImageHosts'
      ? normalizeTrustedRemoteImageHosts(value) as PreviewConfig[K]
      : value;
    await saveSettings({});
  };

  /**
   * Update knowledge-copilot specific setting
   */
  const updateKnowledgeCopilotSetting = async <K extends keyof KnowledgeCopilotSettings>(
    key: K,
    value: KnowledgeCopilotSettings[K]
  ) => {
    const currentEmbeddingSource = config.value.aiSources.sources.find(
      source => source.id === config.value.knowledgeCopilot.embeddingSourceId,
    );
    config.value.knowledgeCopilot[key] = normalizeKnowledgeCopilotNumber(
      key,
      value,
      currentEmbeddingSource?.provider,
    );

    // Auto-update model if sourceId changes
    if (key === 'embeddingSourceId') {
      const source = config.value.aiSources.sources.find(s => s.id === String(value));
      config.value.knowledgeCopilot.embeddingModel = source
        ? resolveAiSourceModel(source, 'embedding')
        : '';
      config.value.knowledgeCopilot.rebuildConcurrency = normalizeKnowledgeCopilotRebuildConcurrency(
        config.value.knowledgeCopilot.rebuildConcurrency,
        source?.provider,
      );
    }
    if (key === 'askChatSourceId' || key === 'agentChatSourceId') {
      const source = config.value.aiSources.sources.find(s => s.id === String(value));
      const modelKey = key === 'askChatSourceId' ? 'askChatModel' : 'agentChatModel';
      config.value.knowledgeCopilot[modelKey] = source
        ? resolveAiSourceModel(source, 'chat')
        : '';
    }
    if (key === 'rerankerSourceId') {
      const source = config.value.aiSources.sources.find(s => s.id === String(value));
      config.value.knowledgeCopilot.rerankerModel = source
        ? resolveAiSourceModel(source, 'reranker')
        : '';
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
    const newSource = { ...source, id: Date.now().toString() };
    config.value.aiSources.sources.push(newSource);
    await saveSettings({});
    return newSource;
  };

  /**
   * Remove an AI source by ID
   */
  const removeAiSource = async (id: string) => {
    if (isBuiltInAiSourceId(id)) {
      return;
    }

    config.value.aiSources.sources = config.value.aiSources.sources.filter((s) => s.id !== id);
    if (config.value.aiAssistant.sourceId === id) {
      config.value.aiAssistant.sourceId = '';
    }
    if (config.value.knowledgeCopilot.embeddingSourceId === id) {
      config.value.knowledgeCopilot.embeddingSourceId = '';
      config.value.knowledgeCopilot.embeddingModel = '';
    }
    if (config.value.knowledgeCopilot.askChatSourceId === id) {
      config.value.knowledgeCopilot.askChatSourceId = BUILT_IN_AI_SOURCE_ID;
      config.value.knowledgeCopilot.askChatModel = BUILT_IN_AI_MODELS.chat;
    }
    if (config.value.knowledgeCopilot.agentChatSourceId === id) {
      config.value.knowledgeCopilot.agentChatSourceId = BUILT_IN_AI_SOURCE_ID;
      config.value.knowledgeCopilot.agentChatModel = BUILT_IN_AI_MODELS.chat;
    }
    if (config.value.knowledgeCopilot.rerankerSourceId === id) {
      config.value.knowledgeCopilot.rerankerSourceId = '';
      config.value.knowledgeCopilot.rerankerModel = '';
    }
    await saveSettings({});
  };

  /**
   * Update an existing AI source
   */
  const updateAiSource = async (id: string, updates: Partial<AISource>) => {
    if (isBuiltInAiSourceId(id)) {
      return;
    }

    const source = config.value.aiSources.sources.find((s) => s.id === id);
    if (source) {
      Object.assign(source, updates);
      if (config.value.aiAssistant.sourceId === id && !sourceSupportsCapability(source, 'chat')) {
        config.value.aiAssistant.sourceId = '';
      }
      if (config.value.knowledgeCopilot.embeddingSourceId === id && !sourceSupportsCapability(source, 'embedding')) {
        config.value.knowledgeCopilot.embeddingSourceId = '';
        config.value.knowledgeCopilot.embeddingModel = '';
      }
      if (config.value.knowledgeCopilot.askChatSourceId === id && !sourceSupportsCapability(source, 'chat')) {
        config.value.knowledgeCopilot.askChatSourceId = BUILT_IN_AI_SOURCE_ID;
        config.value.knowledgeCopilot.askChatModel = BUILT_IN_AI_MODELS.chat;
      }
      if (config.value.knowledgeCopilot.agentChatSourceId === id && !sourceSupportsCapability(source, 'chat')) {
        config.value.knowledgeCopilot.agentChatSourceId = BUILT_IN_AI_SOURCE_ID;
        config.value.knowledgeCopilot.agentChatModel = BUILT_IN_AI_MODELS.chat;
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
        const source = config.value.aiSources.sources.find((s) => s.id === config.value.aiAssistant.sourceId);
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

  const exportDiagnosticLogs = async (): Promise<DiagnosticLogExportResult | null> => {
    if (isExportingDiagnosticLogs.value) {
      return null;
    }

    isExportingDiagnosticLogs.value = true;
    try {
      return await settingsService.exportDiagnosticLogs();
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      settingsLogger.error(`Failed to export diagnostic logs: ${message}`);
      return {
        status: DIAGNOSTIC_EXPORT_STATUS.FAILED,
        error: message,
      };
    } finally {
      isExportingDiagnosticLogs.value = false;
    }
  };

  const exportSettings = (): Promise<boolean> => settingsService.exportConfig();

  const importSettings = async (): Promise<boolean> => {
    try {
      const importedConfig = await settingsService.importConfig();
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
      const resetConfig = await settingsService.resetConfig();
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

  const persistence = {
    get isLoading(): boolean {
      return isLoading.value;
    },
    load: loadSettings,
    save: saveSettings,
    exportConfig: exportSettings,
    importConfig: importSettings,
    reset: resetSettings,
  };

  const general = {
    setLanguage,
    setAutoStartup,
    update: updateGeneralSetting,
  };

  const editor = {
    update: updateEditorSetting,
  };

  const preview = {
    update: updatePreviewSetting,
  };

  const aiSources = {
    add: addAiSource,
    remove: removeAiSource,
    update: updateAiSource,
    testConnection,
  };

  const aiAssistant = {
    update: updateAssistantSetting,
  };

  const knowledgeCopilot = {
    update: updateKnowledgeCopilotSetting,
  };

  const sync = {
    update: updateSyncSetting,
    updateProvider: updateSyncProviderSetting,
    resetProvider: resetSyncProviderSetting,
  };

  const noteStorage = {
    setPath: setnoteStoragePath,
    update: updateNoteStorageSetting,
    updateScheduledBackup: updateScheduledBackupSetting,
  };

  const privacyLog = {
    get isExportingDiagnostics(): boolean {
      return isExportingDiagnosticLogs.value;
    },
    update: updatePrivacyLogSetting,
    openDirectory: openLogDir,
    exportDiagnostics: exportDiagnosticLogs,
  };

  const softwareUpdate = {
    update: updateSoftwareUpdateSetting,
  };

  const appShell = {
    update: (value: AppShellSettings) => updateSetting('appShell', value),
  };

  const workbench = {
    update: (value: WorkbenchSettings) => updateSetting('workbench', value),
  };

  return {
    scheduledBackupError,
    scheduledBackupRunning,
    scheduledBackupRetryRequest,
    config,
    persistence,
    general,
    editor,
    preview,
    aiSources,
    aiAssistant,
    knowledgeCopilot,
    sync,
    noteStorage,
    privacyLog,
    softwareUpdate,
    appShell,
    workbench,
  };
});
