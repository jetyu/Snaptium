import { defineStore } from 'pinia';
import { ref, toRaw } from 'vue';
import { settingsService } from '../services/settings.service';
import { switchLanguage } from '@renderer/features/i18n';
import { createLogger } from '@renderer/features/logger';
import { DEFAULT_RAG_CONFIG } from '@renderer/features/rag/constants/rag.constants';
import { UPDATER_CONSTANTS } from '@renderer/features/updater/constants/updater.constants';

export interface AISource {
  id: string;
  name: string;
  endpoint: string;
  apiKey: string;
  defaultModel: string;
}

export interface AIAssistantSettings {
  enabled: boolean;
  sourceId: string;
  model: string;
  typingDelay: number;
  minInputLength: number;
  systemPrompt: string;
}

export interface RAGSettings {
  enabled: boolean;
  embeddingSourceId: string;
  embeddingModel: string;
  ragChatSourceId: string;
  ragChatModel: string;
  chunkSize: number;
  chunkOverlap: number;
  topK: number;
  similarityThreshold: number;
  autoIndex: boolean;
  indexOnSave: boolean;
}

export interface AppSettings {
  language: string;
  autoStartup: boolean;
  themeMode: 'system' | 'light' | 'dark';
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
  rag: RAGSettings;
  loggingEnabled: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  noteSavePath: string;
  autoCheckUpdates: boolean;
  updateCheckInterval: number;
  maxHistoryVersions: number;
  trashAutoClearDays: number;
  snapshotInterval: number;
  // ... future properties
}

export const useSettingsStore = defineStore('settings', () => {
  const settingsLogger = createLogger('SettingsStore');
  const config = ref<AppSettings>({
    language: 'zh-CN',
    autoStartup: false,
    themeMode: 'system',
    editorFontSize: 16,
    editorFont: '',
    showLineNumbers: true,
    wordWrap: false,
    codeFolding: true,
    highlightActiveLine: true,
    bracketMatching: true,
    autoCloseBrackets: true,
    autoIndent: true,
    showStatusBar: true,
    aiSources: [],
    aiAssistant: {
      enabled: false,
      sourceId: '',
      model: '',
      typingDelay: 2000,
      minInputLength: 10,
      systemPrompt: '',
    },
    rag: { ...DEFAULT_RAG_CONFIG },
    loggingEnabled: false,
    logLevel: 'info',
    noteSavePath: '',
    autoCheckUpdates: true,
    updateCheckInterval: UPDATER_CONSTANTS.DEFAULT_CHECK_INTERVAL,
    maxHistoryVersions: 50,
    trashAutoClearDays: 30,
    snapshotInterval: 10,
  });

  const isLoading = ref(false);

  /**
   * Load settings from persistent storage (via IPC or LocalStorage)
   */
  const loadSettings = async () => {
    isLoading.value = true;
    try {
      const savedConfig = await settingsService.loadConfig();
      if (savedConfig) {
        config.value = { ...config.value, ...savedConfig };
      }
      config.value.language = await switchLanguage(config.value.language);
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
    config.value = { ...config.value, ...newConfig };
    try {
      // Use toRaw to strip Vue markers and deep clone to avoid IPC issues
      const rawConfig = JSON.parse(JSON.stringify(toRaw(config.value)));
      const savedConfig = await settingsService.saveConfig(rawConfig);
      config.value = { ...config.value, ...savedConfig };
    } catch (e) {
      settingsLogger.error(`Failed to save settings: ${e}`);
    }
  };

  const setLanguage = async (language: string) => {
    const nextLanguage = await switchLanguage(language);
    settingsService.notifyLanguageChanged(nextLanguage);
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
      if (source && source.defaultModel) {
        config.value.aiAssistant.model = source.defaultModel;
      }
    }

    await saveSettings({});
  };

  /**
   * Update RAG specific setting
   */
  const updateRAGSetting = async <K extends keyof RAGSettings>(
    key: K,
    value: RAGSettings[K]
  ) => {
    config.value.rag[key] = value;

    // Auto-update model if embeddingSourceId changes
    if (key === 'embeddingSourceId') {
      const source = config.value.aiSources.find(s => s.id === String(value));
      if (source && source.defaultModel) {
        config.value.rag.embeddingModel = source.defaultModel;
      }
    }

    await saveSettings({});
  };

  /**
   * Add a new AI source
   */
  const addAiSource = async (source: Omit<AISource, 'id'>) => {
    const newSource = { ...source, id: Date.now().toString() };
    config.value.aiSources.push(newSource);
    await saveSettings({});
    return newSource;
  };

  /**
   * Remove an AI source by ID
   */
  const removeAiSource = async (id: string) => {
    config.value.aiSources = config.value.aiSources.filter((s) => s.id !== id);
    if (config.value.aiAssistant.sourceId === id) {
      config.value.aiAssistant.sourceId = '';
    }
    await saveSettings({});
  };

  /**
   * Update an existing AI source
   */
  const updateAiSource = async (id: string, updates: Partial<AISource>) => {
    const source = config.value.aiSources.find((s) => s.id === id);
    if (source) {
      Object.assign(source, updates);
      await saveSettings({});
    }
  };

  /**
   * Test AI connection with provided or saved config
   */
  const testConnection = async (testConfig?: {
    aiEndpoint: string;
    aiApiKey: string;
    aiModel: string;
  }): Promise<{ success: boolean; message?: string }> => {
    try {
      const payload = testConfig || {
        aiEndpoint: '',
        aiApiKey: '',
        aiModel: config.value.aiAssistant.model,
      };

      // If no config provided, try to find the linked source
      if (!testConfig && config.value.aiAssistant.sourceId) {
        const source = config.value.aiSources.find((s) => s.id === config.value.aiAssistant.sourceId);
        if (source) {
          payload.aiEndpoint = source.endpoint;
          payload.aiApiKey = source.apiKey;
        }
      }

      return await settingsService.testConnection(payload);
    } catch (e) {
      settingsLogger.error(`Failed to test AI connection: ${e}`);
      return { success: false, message: String(e) };
    }
  };

  const openLogDir = (): Promise<boolean | undefined> => settingsService.openLogDir();

  return {
    config,
    isLoading,
    loadSettings,
    saveSettings,
    setLanguage,
    setAutoStartup,
    updateSetting,
    updateAssistantSetting,
    updateRAGSetting,
    addAiSource,
    removeAiSource,
    updateAiSource,
    testConnection,
    openLogDir,
    setNoteSavePath,
  };
});
