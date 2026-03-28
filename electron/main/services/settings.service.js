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

  /**
   * Load settings from file
   */
  async loadConfig() {
    const filePath = this.getSettingsPath();
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Failed to load settings:', error);
      }
      return {};
    }
  },

  /**
   * Save settings to file
   */
  async saveConfig(config) {
    const filePath = this.getSettingsPath();
    try {
      await fs.writeFile(filePath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw error;
    }
  },

  /**
   * Set the application to launch on startup
   */
  async setAutoLaunch(enabled) {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      path: app.getPath('exe'),
    });
  }
};
