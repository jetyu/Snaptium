import { defineStore } from 'pinia';
import { ref } from 'vue';
import { settingsService } from '../services/settings.service';

export interface AppSettings {
  language: string;
  themeMode: 'system' | 'light' | 'dark';
  editorFontSize: number;
  aiProvider: string;
  aiModel: string;
  aiApiKey: string;
  // ... future properties
}

export const useSettingsStore = defineStore('settings', () => {
  const config = ref<AppSettings>({
    language: 'system',
    themeMode: 'system',
    editorFontSize: 16,
    aiProvider: 'openai',
    aiModel: 'gpt-3.5-turbo',
    aiApiKey: '',
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
      await settingsService.saveConfig(config.value);
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  };

  /**
   * Update a specific configuration property
   */
  const updateSetting = async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    config.value[key] = value;
    await saveSettings({});
  };

  return {
    config,
    isLoading,
    loadSettings,
    saveSettings,
    updateSetting,
  };
});
