import { app, dialog, BrowserWindow } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { $t } from '../utils/i18n.js';
import { VFS_CONSTANTS } from '../constants/vfs.constants.js';

export const settingsService = {
  getSettingsPath() {
    return path.join(app.getPath(VFS_CONSTANTS.USER_DATA), VFS_CONSTANTS.PREFERENCES_FILE);
  },

  getDefaultConfig() {
    return {
      language: app.getLocale().toLowerCase().startsWith('en') ? 'en-US' : 'zh-CN',
      autoStartup: false,
      themeMode: 'system',
      editorFontSize: 14,
      editorFont: '',
      showLineNumbers: true,
      wordWrap: false,
      codeFolding: true,
      highlightActiveLine: true,
      bracketMatching: true,
      autoCloseBrackets: true,
      autoIndent: true,
      aiSources: [],
      aiAssistant: {
        enabled: false,
        sourceId: '',
        model: '',
        typingDelay: 2000,
        minInputLength: 10,
        systemPrompt: '',
      },
      loggingEnabled: false,
      logLevel: 'info',
      noteSavePath: path.join(app.getPath(VFS_CONSTANTS.DOCUMENTS_FOLDER), VFS_CONSTANTS.CURRENT_WORKSPACE_NAME),
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
        path: app.getPath(VFS_CONSTANTS.NOTE_TYPE_EXE),
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
  },

  /**
   * Open a directory picker dialog and return the selected path
   */
  async pickDirectory() {
    const focusedWindow = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;

    const result = await dialog.showOpenDialog(focusedWindow, {
      properties: ['openDirectory', 'createDirectory'],
      title: $t('dialog.changeNoteStoragePath'),
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  }
};
