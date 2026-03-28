import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';

const SETTINGS_FILE = 'preferences.json';
export const settingsService = {
  /**
   * Get the path to the preferences file
   */
  getSettingsPath() {
    return path.join(app.getPath('userData'), SETTINGS_FILE);
  },

  getDefaultConfig() {
    return {
      language: app.getLocale().toLowerCase().startsWith('en') ? 'en-US' : 'zh-CN',
      autoStartup: false,
      loggingEnabled: true,
      logLevel: 'info',
    };
  },

  /**
   * Load settings from file
   */
  async loadConfig() {
    const filePath = this.getSettingsPath();
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      return { ...this.getDefaultConfig(), ...parsed };
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Failed to load settings:', error);
      }
      return this.getDefaultConfig();
    }
  },

  /**
   * Save settings to file
   */
  async saveConfig(config) {
    const filePath = this.getSettingsPath();
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      const nextConfig = { ...this.getDefaultConfig(), ...config };
      await fs.writeFile(filePath, JSON.stringify(nextConfig, null, 2), 'utf-8');
      return nextConfig;
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw error;
    }
  },

  /**
   * Set the application to launch on startup
   */
  async setAutoLaunch(enabled) {
    try {
      app.setLoginItemSettings({
        openAtLogin: enabled,
        path: app.getPath('exe'),
      });

      const loginItemSettings = app.getLoginItemSettings();
      return {
        enabled: loginItemSettings.openAtLogin,
        supported: true,
      };
    } catch (error) {
      console.error('Failed to set auto launch:', error);
      return {
        enabled,
        supported: false,
      };
    }
  }
};
