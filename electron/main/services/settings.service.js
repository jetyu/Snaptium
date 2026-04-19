import { app, dialog, BrowserWindow } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { $t } from '../utils/i18n.js';
import { AI_WRITING_DEFAULTS } from '../../shared/ai.constants.js';
import {
  DEFAULT_TRUSTED_REMOTE_IMAGE_HOSTS,
  normalizeTrustedRemoteImageHosts,
} from '../../shared/preview-security.constants.js';
import { DEFAULT_SYNC_SETTINGS, SYNC_INTERVALS, SYNC_PROVIDERS } from '../../shared/sync.constants.js';
import { VFS_CONSTANTS } from '../constants/vfs.constants.js';
import { UPDATER_CONSTANTS } from '../constants/updater.constants.js';
import { loggerService } from './logger.service.js';
import { previewPolicyService } from './preview-policy.service.js';

const logger = loggerService.createLogger('Electron:Settings Service');
const LOG_AUTO_CLEAR_DAY_OPTIONS = new Set([0, 10, 20]);
const DEFAULT_WORKBENCH_VISIBLE_MODULES = [
  'smartRecommendation',
  'recentNotes',
  'favorites',
  'dataStats',
  'recentActivity',
  'recentQuestions',
  'relatedNotes',
  'behaviorFeedback',
];

function interpolateMessage(template, replacements = {}) {
  return Object.entries(replacements).reduce((message, [key, value]) => {
    return message.replaceAll(`{${key}}`, String(value));
  }, template);
}

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

function createDefaultSyncConfig() {
  return {
    ...DEFAULT_SYNC_SETTINGS,
    webdav: { ...DEFAULT_SYNC_SETTINGS.webdav },
    ossS3: { ...DEFAULT_SYNC_SETTINGS.ossS3 },
  };
}

function normalizeSyncProvider(provider) {
  return provider === SYNC_PROVIDERS.OSS_S3 ? SYNC_PROVIDERS.OSS_S3 : SYNC_PROVIDERS.WEBDAV;
}

function normalizeSyncIntervalMinutes(value) {
  const supportedIntervals = new Set(Object.values(SYNC_INTERVALS));
  const normalizedValue = Number(value);
  return supportedIntervals.has(normalizedValue) ? normalizedValue : SYNC_INTERVALS.MANUAL;
}

function normalizeSyncConfig(config = {}) {
  const defaultConfig = createDefaultSyncConfig();
  const mergedConfig = {
    ...defaultConfig,
    ...config,
    webdav: {
      ...defaultConfig.webdav,
      ...(config.webdav || {}),
    },
    ossS3: {
      ...defaultConfig.ossS3,
      ...(config.ossS3 || {}),
    },
  };

  return {
    ...mergedConfig,
    enabled: Boolean(mergedConfig.enabled),
    provider: normalizeSyncProvider(mergedConfig.provider),
    intervalMinutes: normalizeSyncIntervalMinutes(mergedConfig.intervalMinutes),
    autoSyncOnSave: Boolean(mergedConfig.autoSyncOnSave),
    remotePath: String(mergedConfig.remotePath ?? defaultConfig.remotePath).trim() || defaultConfig.remotePath,
    webdav: {
      url: String(mergedConfig.webdav.url ?? '').trim(),
      username: String(mergedConfig.webdav.username ?? '').trim(),
      password: String(mergedConfig.webdav.password ?? ''),
    },
    ossS3: {
      endpoint: String(mergedConfig.ossS3.endpoint ?? '').trim(),
      region: String(mergedConfig.ossS3.region ?? '').trim(),
      bucket: String(mergedConfig.ossS3.bucket ?? '').trim(),
      accessKeyId: String(mergedConfig.ossS3.accessKeyId ?? '').trim(),
      secretAccessKey: String(mergedConfig.ossS3.secretAccessKey ?? ''),
      forcePathStyle: Boolean(mergedConfig.ossS3.forcePathStyle),
    },
    lastSyncedAt: Number.isFinite(Number(mergedConfig.lastSyncedAt)) ? Number(mergedConfig.lastSyncedAt) : null,
  };
}

function normalizePreviewAppearanceConfig(config = {}) {
  const remoteImageMode = config.remoteImageMode === 'blocked' ? 'blocked' : 
                         config.remoteImageMode === 'all' ? 'all' : 'trusted';

  return {
    allowHtml: config.allowHtml !== false,
    allowInlineSvg: config.allowInlineSvg !== false,
    remoteImageMode,
    trustedRemoteImageHosts: normalizeTrustedRemoteImageHosts(config.trustedRemoteImageHosts),
    fontSize: Number.isFinite(Number(config.fontSize)) ? Number(config.fontSize) : 16,
    fontFamily: String(config.fontFamily || ''),
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
    previewAppearance: normalizePreviewAppearanceConfig(incomingConfig.previewAppearance),
    sync: normalizeSyncConfig(incomingConfig.sync),
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
      sync: createDefaultSyncConfig(),
      loggingEnabled: false,
      logLevel: 'error',
      logAutoClearDays: 10,
      noteSavePath: path.join(app.getPath(VFS_CONSTANTS.DOCUMENTS_FOLDER), VFS_CONSTANTS.CURRENT_WORKSPACE_NAME),
      autoCheckUpdates: true,
      updateCheckInterval: UPDATER_CONSTANTS.DEFAULT_CHECK_INTERVAL,
      maxHistoryVersions: 50,
      trashAutoClearDays: 30,
      snapshotInterval: 15,
      appShell: {
        activeMainView: 'workbench',
        customSidebarModules: ['search', 'settings', 'trash'],
        maxCustomSidebarModules: 4,
      },
      workbench: {
        visibleModuleIds: [...DEFAULT_WORKBENCH_VISIBLE_MODULES],
        favoriteNoteIds: [],
        recentNotes: [],
        recentQuestions: [],
      },
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
      const nextConfig = normalizeLoggingConfig(mergeConfigWithDefaults(this.getDefaultConfig(), parsed));
      previewPolicyService.updateConfig(nextConfig);
      return nextConfig;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.error('Failed to load settings', { error: error.message });
      }
      const nextConfig = normalizeLoggingConfig(this.getDefaultConfig());
      previewPolicyService.updateConfig(nextConfig);
      return nextConfig;
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
      previewPolicyService.updateConfig(nextConfig);
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

  async confirmDeleteAiSource(name) {
    const focusedWindow = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;

    const { response } = await dialog.showMessageBox(focusedWindow, {
      type: 'warning',
      buttons: [$t('dialog.cancel'), $t('trash.delete')],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
      title: $t('common.delete'),
      message: interpolateMessage($t('dialog.deleteConfirm'), { name }),
    });

    return response === 1;
  },

  async confirmResetSyncProvider(name) {
    const focusedWindow = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;

    const { response } = await dialog.showMessageBox(focusedWindow, {
      type: 'warning',
      buttons: [$t('dialog.cancel'), $t('button.clearConfig')],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
      title: $t('common.confirm'),
      message: interpolateMessage($t('dialog.confirmResetSyncProvider'), { name }),
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
