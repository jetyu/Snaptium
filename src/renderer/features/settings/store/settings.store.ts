import { defineStore } from 'pinia';
import { ref } from 'vue';
import { settingsService } from '../services/settings.service';
import { switchLanguage } from '@renderer/features/i18n';

export interface AppSettings {
  language: string;
  autoStartup: boolean;
  themeMode: 'system' | 'light' | 'dark';
  editorFontSize: number;
  aiProvider: string;
  aiModel: string;
  aiApiKey: string;
  loggingEnabled: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  // ... future properties
}

export const useSettingsStore = defineStore('settings', () => {
  const config = ref<AppSettings>({
    language: 'zh-CN',
    autoStartup: false,
    themeMode: 'system',
    editorFontSize: 16,
    aiProvider: 'openai',
    aiModel: 'gpt-3.5-turbo',
    aiApiKey: '',
    loggingEnabled: true,
    logLevel: 'info',
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
      console.error('Failed to load settings:', e);
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
      const savedConfig = await settingsService.saveConfig(config.value);
      config.value = { ...config.value, ...savedConfig };
    } catch (e) {
      console.error('Failed to save settings:', e);
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
      console.error('Failed to set auto startup:', e);
    }
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

  return {
    config,
    isLoading,
    loadSettings,
    saveSettings,
    setLanguage,
    setAutoStartup,
    updateSetting,
    openLogDir: () => (window as any).electronAPI.logger.openDir(),
  };
});
