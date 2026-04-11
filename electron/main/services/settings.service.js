import { app, dialog, BrowserWindow } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { $t } from '../utils/i18n.js';
import { AI_WRITING_DEFAULTS } from '../../shared/ai.constants.js';
import { VFS_CONSTANTS } from '../constants/vfs.constants.js';
import { UPDATER_CONSTANTS } from '../constants/updater.constants.js';
import { loggerService } from './logger.service.js';

const logger = loggerService.createLogger('Electron:Settings Service');
const LOG_AUTO_CLEAR_DAY_OPTIONS = new Set([0, 10, 20]);

function normalizeLogLevel(logLevel) {
  if (typeof logLevel !== 'string') {
    return 'error';
  }

  const normalizedLevel = logLevel.toLowerCase();
  const supportedLevels = new Set(['debug', 'info', 'warn', 'error']);

  if (!supportedLevels.has(normalizedLevel)) {
    return 'error';
  }

  return normalizedLevel;
}

function normalizeLogAutoClearDays(days) {
  const normalizedDays = Number(days);

  if (!Number.isFinite(normalizedDays)) {
    return 0;
  }

  return LOG_AUTO_CLEAR_DAY_OPTIONS.has(normalizedDays) ? normalizedDays : 0;
}

function normalizeLoggingConfig(config) {
  return {
    ...config,
    loggingEnabled: Boolean(config.loggingEnabled),
    logLevel: normalizeLogLevel(config.logLevel),
    logAutoClearDays: normalizeLogAutoClearDays(config.logAutoClearDays),
  };
}

function mergeConfigWithDefaults(defaultConfig, incomingConfig = {}) {
  return {
    ...defaultConfig,
    ...incomingConfig,
    aiAssistant: {
      ...defaultConfig.aiAssistant,
      ...(incomingConfig.aiAssistant || {}),
    },
    rag: {
      ...defaultConfig.rag,
      ...(incomingConfig.rag || {}),
    },
  };
}

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
      wordWrap: true,
      codeFolding: false,
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
        writingStyle: AI_WRITING_DEFAULTS.STYLE,
        writingScenario: AI_WRITING_DEFAULTS.SCENARIO,
        systemPrompt: '',
      },
      rag: {
        enabled: false,
        embeddingSourceId: '',
        embeddingModel: '',
        ragChatSourceId: '',
        ragChatModel: '',
        chunkSize: 500,
        chunkOverlap: 50,
        topK: 5,
        similarityThreshold: 0.45,
        autoIndex: false,
        indexOnSave: false,
        lastIndexedAt: null,
      },
      loggingEnabled: false,
      logLevel: 'error',
      logAutoClearDays: 10,
      noteSavePath: path.join(app.getPath(VFS_CONSTANTS.DOCUMENTS_FOLDER), VFS_CONSTANTS.CURRENT_WORKSPACE_NAME),
      autoCheckUpdates: true,
      updateCheckInterval: UPDATER_CONSTANTS.DEFAULT_CHECK_INTERVAL,
      maxHistoryVersions: 50,
      trashAutoClearDays: 30,
      snapshotInterval: 15,
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
      return normalizeLoggingConfig(mergeConfigWithDefaults(this.getDefaultConfig(), parsed));
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.error('Failed to load settings', { error: error.message });
      }
      return normalizeLoggingConfig(this.getDefaultConfig());
    }
  },

  /**
   * Save settings to file
   */
  async saveConfig(config) {
    const filePath = this.getSettingsPath();
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      const nextConfig = normalizeLoggingConfig(mergeConfigWithDefaults(this.getDefaultConfig(), config));
      await fs.writeFile(filePath, JSON.stringify(nextConfig, null, 2), 'utf-8');
      return nextConfig;
    } catch (error) {
      logger.error('Failed to save settings', { error: error.message });
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
      logger.error('Failed to set auto launch', { error: error.message });
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
  },

  async confirmEmbeddingSourceChange() {
    const focusedWindow = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;

    const { response } = await dialog.showMessageBox(focusedWindow, {
      type: 'warning',
      buttons: [$t('dialog.cancel'), $t('button.changeAndRebuildIndex')],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
      message: $t('message.confirm.changeEmbeddingModel'),
    });

    return response === 1;
  },

  /**
   * Export settings to a JSON file
   */
  async exportConfig() {
    const focusedWindow = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;

    const result = await dialog.showSaveDialog(focusedWindow, {
      title: $t('pref.setting.backupFileName'),
      defaultPath: path.join(app.getPath('desktop'), $t('pref.setting.backupFileName') + '.json'),
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });

    if (result.canceled || !result.filePath) {
      return false;
    }

    try {
      const currentFilePath = this.getSettingsPath();
      await fs.copyFile(currentFilePath, result.filePath);
      return true;
    } catch (error) {
      logger.error('Failed to export settings', { error: error.message });
      throw error;
    }
  },

  /**
   * Reset settings to defaults and restart the application
   */
  async resetConfig() {
    const focusedWindow = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;

    const { response } = await dialog.showMessageBox(focusedWindow, {
      type: 'warning',
      buttons: [$t('dialog.ok'), $t('dialog.cancel')],
      defaultId: 1,
      cancelId: 1,
      message: $t('resetConfirmNotify'),
    });

    if (response !== 0) {
      return false;
    }

    try {
      const targetFilePath = this.getSettingsPath();
      const defaultConfig = this.getDefaultConfig();
      await fs.writeFile(targetFilePath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
      return true;
    } catch (error) {
      logger.error('Failed to reset settings', { error: error.message });
      throw error;
    }
  },

  /**
   * Import settings from a JSON file and restart the application
   */
  async importConfig() {
    const focusedWindow = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;

    const result = await dialog.showOpenDialog(focusedWindow, {
      title: $t('pref.setting.backupFileName'),
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return false;
    }

    try {
      const importPath = result.filePaths[0];
      const content = await fs.readFile(importPath, 'utf-8');

      // Basic validation
      JSON.parse(content);

      const targetFilePath = this.getSettingsPath();
      await fs.copyFile(importPath, targetFilePath);

      return true;
    } catch (error) {
      logger.error('Failed to import settings', { error: error.message });
      throw error;
    }
  }
};
