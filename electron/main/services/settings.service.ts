import { app, dialog, BrowserWindow } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { $t } from '../utils/i18n.js';
import { AI_WRITING_DEFAULTS } from '../../shared/ai.constants.js';
import {
  OFFICIAL_AI_MODELS,
  OFFICIAL_AI_SOURCE_IDS,
  getOfficialAiSources,
  isOfficialAiSourceId,
} from '../../shared/official-ai.constants.js';
import {
  DEFAULT_TRUSTED_REMOTE_IMAGE_HOSTS,
  normalizeTrustedRemoteImageHosts,
} from '../../shared/preview-security.constants.js';
import { DEFAULT_SYNC_SETTINGS, SYNC_INTERVALS, SYNC_PROVIDERS } from '../../shared/sync.constants.js';
import { DEFAULT_UPDATE_CHANNEL, normalizeUpdateChannel, type UpdateChannel } from '../../shared/updater.constants.js';
import { getErrorCode, getErrorMessage } from '../../shared/utils/error.utils.js';
import { VFS_CONSTANTS } from '../constants/vfs.constants.js';
import { UPDATER_CONSTANTS } from '../constants/updater.constants.js';
import { type AccessControlTimeout } from '../../shared/e2ee.constants.js';
import { loggerService } from './logger.service.js';
import { previewPolicyService } from './preview-policy.service.js';
import { keyManagerService } from './key-manager.service.js';
import type { KeySlots } from './crypto.service.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type RemoteImageMode = 'blocked' | 'trusted' | 'all';
type WindowCloseAction = 'minimize' | 'exit';
type AccentMode = 'black' | 'azureBlue' | 'indigo' | 'cyan' | 'teal';

interface SyncWebDavConfig {
  url: string;
  username: string;
  password: string;
}

interface SyncOssS3Config {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

interface SyncConfig {
  enabled: boolean;
  provider: (typeof SYNC_PROVIDERS)[keyof typeof SYNC_PROVIDERS];
  intervalMinutes: number;
  autoSyncOnSave: boolean;
  remotePath: string;
  webdav: SyncWebDavConfig;
  ossS3: SyncOssS3Config;
  lastSyncedAt: number | null;
}

interface PreviewAppearanceConfig {
  allowHtml: boolean;
  allowInlineSvg: boolean;
  remoteImageMode: RemoteImageMode;
  trustedRemoteImageHosts: string[];
  fontSize: number;
  fontFamily: string;
}

interface SettingsMessageOptions {
  type?: 'none' | 'info' | 'error' | 'question' | 'warning';
  title?: string;
  message: string;
  detail?: string;
}

type RagRebuildMode = 'incremental' | 'full' | 'cancel';

export interface AccessControlConfig {
  enabled: boolean;
  lockOnStartup: boolean;
  autoLockTimeoutMinutes: AccessControlTimeout;
}

interface AppSettings {
  language: string;
  autoStartup: boolean;
  windowCloseAction: WindowCloseAction;
  themeMode: 'system' | 'light' | 'dark';
  accentMode: AccentMode;
  previewAppearance: PreviewAppearanceConfig;
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
  aiSources: AiSourceSettings[];
  aiAssistant: Record<string, unknown>;
  rag: Record<string, unknown>;
  sync: SyncConfig;
  loggingEnabled: boolean;
  logLevel: LogLevel;
  logAutoClearDays: number;
  noteSavePath: string;
  autoCheckUpdates: boolean;
  updateCheckInterval: number;
  updateChannel: UpdateChannel;
  maxHistoryVersions: number;
  trashAutoClearDays: number;
  snapshotInterval: number;
  appShell: {
    activeMainView: string;
    customSidebarModules: string[];
    maxCustomSidebarModules: number;
  };
  workbench: {
    recentQuestions: unknown[];
    recommendationFeedback: unknown[];
    onboardingGuideActivated: boolean;
    onboardingGuideDismissed: boolean;
    agentWriteMode: 'confirm' | 'auto';
  };
  accessControl: AccessControlConfig;
}

interface SnaptiumConfigPackage {
  type: 'sppcfg';
  version: number;
  exportedAt: number;
  app: string;
  settings: SettingsInput;
  e2ee?: {
    keySlots?: KeySlots;
  };
}

type SyncConfigInput = Partial<SyncConfig> & {
  webdav?: Partial<SyncWebDavConfig>;
  ossS3?: Partial<SyncOssS3Config>;
};

type SettingsInput = Partial<AppSettings> & {
  aiAssistant?: Partial<Record<string, unknown>>;
  rag?: Partial<Record<string, unknown>>;
  previewAppearance?: Partial<PreviewAppearanceConfig>;
  sync?: SyncConfigInput;
  accessControl?: Partial<AccessControlConfig>;
  workbench?: Partial<AppSettings['workbench']>;
};

const logger = loggerService.createLogger('Electron:Settings Service');
const LOG_AUTO_CLEAR_DAY_OPTIONS: ReadonlySet<number> = new Set<number>([0, 10, 20]);
const SNAPTIUM_CONFIG_PACKAGE_TYPE = 'sppcfg' as const;
const SNAPTIUM_CONFIG_PACKAGE_VERSION = 1;
const SNAPTIUM_CONFIG_EXTENSION = 'sppcfg' as const;
const DEFAULT_WINDOW_CLOSE_ACTION: WindowCloseAction = 'minimize';

interface AiSourceSettings {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  aiModel: string;
  capabilities: string[];
  official?: boolean;
  locked?: boolean;
}

function interpolateMessage(template: string, replacements: Record<string, string> = {}): string {
  return Object.entries(replacements).reduce((message, [key, value]) => {
    return message.replaceAll(`{${key}}`, String(value));
  }, template);
}

function normalizeWindowCloseAction(value: unknown): WindowCloseAction {
  return value === 'exit' ? 'exit' : DEFAULT_WINDOW_CLOSE_ACTION;
}

function normalizeAccentMode(value: unknown): AccentMode {
  return value === 'black' || value === 'azureBlue' || value === 'indigo' || value === 'cyan' || value === 'teal'
    ? value
    : 'azureBlue';
}

function normalizeLogLevel(logLevel: unknown): LogLevel {
  if (typeof logLevel !== 'string') {
    return 'error';
  }

  const normalizedLevel = logLevel.toLowerCase();
  const supportedLevels: ReadonlySet<string> = new Set<string>(['debug', 'info', 'warn', 'error']);

  if (!supportedLevels.has(normalizedLevel)) {
    return 'error';
  }

  return normalizedLevel as LogLevel;
}

function normalizeLogAutoClearDays(days: unknown): number {
  const normalizedDays = Number(days);

  if (!Number.isFinite(normalizedDays)) {
    return 0;
  }

  return LOG_AUTO_CLEAR_DAY_OPTIONS.has(normalizedDays) ? normalizedDays : 0;
}

function normalizeLoggingConfig(config: AppSettings): AppSettings {
  return {
    ...config,
    loggingEnabled: Boolean(config.loggingEnabled),
    logLevel: normalizeLogLevel(config.logLevel),
    logAutoClearDays: normalizeLogAutoClearDays(config.logAutoClearDays),
  };
}

function createDefaultSyncConfig(): SyncConfig {
  return {
    ...DEFAULT_SYNC_SETTINGS,
    webdav: { ...DEFAULT_SYNC_SETTINGS.webdav },
    ossS3: { ...DEFAULT_SYNC_SETTINGS.ossS3 },
  };
}

function normalizeSyncProvider(provider: unknown): SyncConfig['provider'] {
  return provider === SYNC_PROVIDERS.OSS_S3 ? SYNC_PROVIDERS.OSS_S3 : SYNC_PROVIDERS.WEBDAV;
}

function normalizeSyncIntervalMinutes(value: unknown): number {
  const supportedIntervals: ReadonlySet<number> = new Set<number>(Object.values(SYNC_INTERVALS));
  const normalizedValue = Number(value);
  return supportedIntervals.has(normalizedValue) ? normalizedValue : SYNC_INTERVALS.MANUAL;
}

function normalizeSyncConfig(config: SyncConfigInput = {}): SyncConfig {
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

function normalizePreviewAppearanceConfig(config: Partial<PreviewAppearanceConfig> = {}): PreviewAppearanceConfig {
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

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim());
}

function normalizeCustomAiSource(value: unknown): AiSourceSettings | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = String(value.id ?? '').trim();
  if (!id || isOfficialAiSourceId(id)) {
    return null;
  }

  return {
    id,
    name: String(value.name ?? '').trim(),
    baseUrl: String(value.baseUrl ?? '').trim(),
    apiKey: String(value.apiKey ?? ''),
    aiModel: String(value.aiModel ?? '').trim(),
    capabilities: normalizeStringArray(value.capabilities),
    official: false,
    locked: false,
  };
}

function normalizeAiSources(value: unknown): AiSourceSettings[] {
  const customSources = Array.isArray(value)
    ? value
      .map((source) => normalizeCustomAiSource(source))
      .filter((source): source is AiSourceSettings => source !== null)
    : [];

  return [
    ...getOfficialAiSources(),
    ...customSources,
  ];
}

function normalizeAiAssistantConfig(
  defaultConfig: AppSettings['aiAssistant'],
  incomingConfig: SettingsInput['aiAssistant'],
): Record<string, unknown> {
  const mergedConfig: Record<string, unknown> = {
    ...defaultConfig,
    ...(incomingConfig || {}),
  };
  const sourceId = String(mergedConfig.sourceId ?? '').trim();

  if (!sourceId || sourceId === OFFICIAL_AI_SOURCE_IDS.CHAT) {
    return {
      ...mergedConfig,
      sourceId: OFFICIAL_AI_SOURCE_IDS.CHAT,
      model: OFFICIAL_AI_MODELS.CHAT,
    };
  }

  return mergedConfig;
}

function normalizeRagConfig(
  defaultConfig: AppSettings['rag'],
  incomingConfig: SettingsInput['rag'],
): Record<string, unknown> {
  const mergedConfig: Record<string, unknown> = {
    ...defaultConfig,
    ...(incomingConfig || {}),
  };
  const embeddingSourceId = String(mergedConfig.embeddingSourceId ?? '').trim();
  const ragChatSourceId = String(mergedConfig.ragChatSourceId ?? '').trim();
  const nextConfig: Record<string, unknown> = { ...mergedConfig };

  if (!embeddingSourceId || embeddingSourceId === OFFICIAL_AI_SOURCE_IDS.EMBEDDING) {
    nextConfig.embeddingSourceId = OFFICIAL_AI_SOURCE_IDS.EMBEDDING;
    nextConfig.embeddingModel = OFFICIAL_AI_MODELS.EMBEDDING;
  }

  if (ragChatSourceId === OFFICIAL_AI_SOURCE_IDS.CHAT) {
    nextConfig.ragChatModel = OFFICIAL_AI_MODELS.CHAT;
  }

  return nextConfig;
}

function normalizeUpdateCheckInterval(value: unknown): number {
  const normalizedValue = Math.trunc(Number(value));
  return Number.isFinite(normalizedValue) && normalizedValue >= 60 * 60 * 1000
    ? normalizedValue
    : UPDATER_CONSTANTS.DEFAULT_CHECK_INTERVAL;
}

function mergeConfigWithDefaults(defaultConfig: AppSettings, incomingConfig: SettingsInput = {}): AppSettings {
  return {
    ...defaultConfig,
    ...incomingConfig,
    windowCloseAction: normalizeWindowCloseAction(incomingConfig.windowCloseAction ?? defaultConfig.windowCloseAction),
    accentMode: normalizeAccentMode(incomingConfig.accentMode ?? defaultConfig.accentMode),
    aiSources: normalizeAiSources(incomingConfig.aiSources ?? defaultConfig.aiSources),
    aiAssistant: normalizeAiAssistantConfig(defaultConfig.aiAssistant, incomingConfig.aiAssistant),
    rag: normalizeRagConfig(defaultConfig.rag, incomingConfig.rag),
    previewAppearance: normalizePreviewAppearanceConfig(incomingConfig.previewAppearance),
    sync: normalizeSyncConfig(incomingConfig.sync),
    autoCheckUpdates: incomingConfig.autoCheckUpdates ?? defaultConfig.autoCheckUpdates,
    updateCheckInterval: normalizeUpdateCheckInterval(incomingConfig.updateCheckInterval),
    updateChannel: normalizeUpdateChannel(incomingConfig.updateChannel ?? defaultConfig.updateChannel),
    accessControl: {
      ...defaultConfig.accessControl,
      ...(incomingConfig.accessControl || {}),
    },
    workbench: {
      ...defaultConfig.workbench,
      ...(incomingConfig.workbench || {}),
      recentQuestions: Array.isArray(incomingConfig.workbench?.recentQuestions)
        ? incomingConfig.workbench.recentQuestions
        : defaultConfig.workbench.recentQuestions,
      recommendationFeedback: Array.isArray(incomingConfig.workbench?.recommendationFeedback)
        ? incomingConfig.workbench.recommendationFeedback
        : defaultConfig.workbench.recommendationFeedback,
      onboardingGuideActivated: incomingConfig.workbench?.onboardingGuideActivated === true,
      onboardingGuideDismissed: incomingConfig.workbench?.onboardingGuideDismissed === true,
      agentWriteMode: incomingConfig.workbench?.agentWriteMode === 'auto' ? 'auto' : 'confirm',
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSnaptiumConfigPackage(value: unknown): value is SnaptiumConfigPackage {
  if (!isRecord(value)) {
    return false;
  }

  return value.type === SNAPTIUM_CONFIG_PACKAGE_TYPE && isRecord(value.settings);
}

export const settingsService = {
  getSettingsPath(): string {
    return path.join(app.getPath(VFS_CONSTANTS.USER_DATA), VFS_CONSTANTS.PREFERENCES_FILE);
  },

  getDefaultConfig(): AppSettings {
    return {
      language: app.getLocale().toLowerCase().startsWith('en') ? 'en-US' : 'zh-CN',
      autoStartup: false,
      windowCloseAction: DEFAULT_WINDOW_CLOSE_ACTION,
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
        typingDelay: 2000,
        minInputLength: 10,
        writingStyle: AI_WRITING_DEFAULTS.STYLE,
        writingScenario: AI_WRITING_DEFAULTS.SCENARIO,
        systemPrompt: '',
      },
      rag: {
        enabled: false,
        embeddingSourceId: OFFICIAL_AI_SOURCE_IDS.EMBEDDING,
        embeddingModel: OFFICIAL_AI_MODELS.EMBEDDING,
        ragChatSourceId: OFFICIAL_AI_SOURCE_IDS.CHAT,
        ragChatModel: OFFICIAL_AI_MODELS.CHAT,
        rerankerSourceId: OFFICIAL_AI_SOURCE_IDS.RERANKER,
        chunkSize: 500,
        chunkOverlap: 50,
        topK: 5,
        similarityThreshold: 0.45,
        autoIndex: false,
        indexOnSave: false,
        lastIndexedAt: null,
        indexSignatures: {},
        indexChunkCounts: {},
        cachedTotalChunks: 0,
      },
      sync: createDefaultSyncConfig(),
      loggingEnabled: false,
      logLevel: 'error',
      logAutoClearDays: 10,
      noteSavePath: path.join(app.getPath(VFS_CONSTANTS.DOCUMENTS_FOLDER), VFS_CONSTANTS.CURRENT_WORKSPACE_NAME),
      autoCheckUpdates: true,
      updateCheckInterval: UPDATER_CONSTANTS.DEFAULT_CHECK_INTERVAL,
      updateChannel: DEFAULT_UPDATE_CHANNEL,
      maxHistoryVersions: 50,
      trashAutoClearDays: 30,
      snapshotInterval: 15,
      appShell: {
        activeMainView: 'workbench',
        customSidebarModules: ['search', 'settings', 'trash'],
        maxCustomSidebarModules: 4,
      },
      workbench: {
        recentQuestions: [],
        recommendationFeedback: [],
        onboardingGuideActivated: false,
        onboardingGuideDismissed: false,
        agentWriteMode: 'confirm',
      },
      accessControl: {
        enabled: false,
        lockOnStartup: false,
        autoLockTimeoutMinutes: 0, // DISABLED
      },
    };
  },

  /**
   * Load settings from file
   */
  async loadConfig(): Promise<AppSettings> {
    const filePath = this.getSettingsPath();
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content) as SettingsInput;
      const nextConfig = normalizeLoggingConfig(mergeConfigWithDefaults(this.getDefaultConfig(), parsed));
      previewPolicyService.updateConfig(nextConfig);
      return nextConfig;
    } catch (error) {
      if (getErrorCode(error) !== 'ENOENT') {
        logger.error('Failed to load settings', { error: getErrorMessage(error) });
      }
      const nextConfig = normalizeLoggingConfig(this.getDefaultConfig());
      previewPolicyService.updateConfig(nextConfig);
      return nextConfig;
    }
  },

  /**
   * Save settings to file
   */
  async saveConfig(config: SettingsInput): Promise<AppSettings> {
    const filePath = this.getSettingsPath();
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      const nextConfig = normalizeLoggingConfig(mergeConfigWithDefaults(this.getDefaultConfig(), config));
      await fs.writeFile(filePath, JSON.stringify(nextConfig, null, 2), 'utf-8');
      previewPolicyService.updateConfig(nextConfig);
      return nextConfig;
    } catch (error) {
      logger.error('Failed to save settings', { error: getErrorMessage(error) });
      throw error;
    }
  },

  /**
   * Set the application to launch on startup
   */
  async setAutoLaunch(enabled: boolean): Promise<{ enabled: boolean; supported: boolean }> {
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
      logger.error('Failed to set auto launch', { error: getErrorMessage(error) });
      return {
        enabled,
        supported: false,
      };
    }
  },

  /**
   * Open a directory picker dialog and return the selected path
   */
  async pickDirectory(): Promise<string | null> {
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

  async showMessage(options: Partial<SettingsMessageOptions> = {}): Promise<boolean> {
    const focusedWindow = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;
    const message = String(options.message ?? '').trim();

    if (!message) {
      return false;
    }

    const detail = typeof options.detail === 'string' ? options.detail.trim() : '';
    const type = ['none', 'info', 'error', 'question', 'warning'].includes(options.type ?? '')
      ? options.type
      : 'info';

    await dialog.showMessageBox(focusedWindow, {
      type,
      noLink: true,
      message,
      detail,
      title: String(options.title ?? '').trim() || app.getName(),
    });

    return true;
  },

  async confirmEmbeddingSourceChange(): Promise<boolean> {
    const focusedWindow = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;

    const dialogResult = await dialog.showMessageBox(focusedWindow, {
      type: 'warning',
      buttons: [$t('button.cancel'), $t('button.changeAndRebuildIndex')],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
      message: $t('message.confirm.changeEmbeddingModel'),
    });
    // selectedButtonIndex is zero-based and follows the order of buttons[]
    const selectedButtonIndex = dialogResult.response;

    return selectedButtonIndex === 1;
  },

  async confirmRagRebuildMode(): Promise<RagRebuildMode> {
    const focusedWindow = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;

    const dialogResult = await dialog.showMessageBox(focusedWindow, {
      type: 'question',
      buttons: [$t('button.cancel'), $t('button.IncrementalRebuildIndex'), $t('button.fullRebuildIndex')],
      defaultId: 1,
      cancelId: 0,
      noLink: true,
      title: $t('label.ragIndexStatus'),
      message: $t('message.confirm.ragRebuildMode'),
    });
    // selectedButtonIndex is zero-based and follows the order of buttons[]
    const selectedButtonIndex = dialogResult.response;

    if (selectedButtonIndex === 1) {
      return 'incremental';
    }

    if (selectedButtonIndex === 2) {
      return 'full';
    }

    return 'cancel';
  },

  async confirmDeleteAiSource(name: string): Promise<boolean> {
    const focusedWindow = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;

    const dialogResult = await dialog.showMessageBox(focusedWindow, {
      type: 'warning',
      buttons: [$t('button.cancel'), $t('button.clear')],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
      title: $t('title.clearConfiguration'),
      message: interpolateMessage($t('workspace.dialog.confirm'), { name: String(name) }),
    });
    // selectedButtonIndex is zero-based and follows the order of buttons[]
    const selectedButtonIndex = dialogResult.response;

    return selectedButtonIndex === 1;
  },

  async confirmResetSyncProvider(name: string): Promise<boolean> {
    const focusedWindow = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;

    const dialogResult = await dialog.showMessageBox(focusedWindow, {
      type: 'warning',
      buttons: [$t('button.cancel'), $t('button.clearConfig')],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
      title: $t('title.resetConfiguration'),
      message: interpolateMessage($t('dialog.confirmResetSyncProvider'), { name: String(name) }),
    });
    // selectedButtonIndex is zero-based and follows the order of buttons[]
    const selectedButtonIndex = dialogResult.response;

    return selectedButtonIndex === 1;
  },

  /**
   * Export settings and E2EE key slots to a Snaptium recovery package.
   */
  async exportConfig(): Promise<boolean> {
    const focusedWindow = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;

    const result = await dialog.showSaveDialog(focusedWindow, {
      title: $t('pref.setting.backupFileName'),
      defaultPath: path.join(app.getPath('desktop'), `${$t('pref.setting.backupFileName')}.${SNAPTIUM_CONFIG_EXTENSION}`),
      filters: [
        { name: 'Snaptium Config', extensions: [SNAPTIUM_CONFIG_EXTENSION] },
      ],
    });

    if (result.canceled || !result.filePath) {
      return false;
    }

    try {
      const settings = await this.loadConfig();
      const keySlots = await keyManagerService.loadKeySlots();
      const configPackage: SnaptiumConfigPackage = {
        type: SNAPTIUM_CONFIG_PACKAGE_TYPE,
        version: SNAPTIUM_CONFIG_PACKAGE_VERSION,
        exportedAt: Date.now(),
        app: app.getName(),
        settings,
        e2ee: keySlots ? { keySlots } : undefined,
      };

      await fs.writeFile(result.filePath, JSON.stringify(configPackage, null, 2), 'utf-8');
      return true;
    } catch (error) {
      logger.error('Failed to export settings', { error: getErrorMessage(error) });
      throw error;
    }
  },

  /**
   * Reset settings to defaults and restart the application
   */
  async resetConfig(): Promise<boolean> {
    const focusedWindow = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;

    const dialogResult = await dialog.showMessageBox(focusedWindow, {
      type: 'warning',
      buttons: [$t('button.confirm'), $t('button.cancel')],
      defaultId: 1,
      cancelId: 1,
      message: $t('dialog.resetConfirmNotify'),
    });
    // selectedButtonIndex is zero-based and follows the order of buttons[]
    const selectedButtonIndex = dialogResult.response;

    if (selectedButtonIndex !== 0) {
      return false;
    }

    try {
      const targetFilePath = this.getSettingsPath();
      const defaultConfig = this.getDefaultConfig();
      await fs.writeFile(targetFilePath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
      return true;
    } catch (error) {
      logger.error('Failed to reset settings', { error: getErrorMessage(error) });
      throw error;
    }
  },

  /**
   * Import settings from a Snaptium recovery package.
   */
  async importConfig(): Promise<boolean> {
    const focusedWindow = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;

    const result = await dialog.showOpenDialog(focusedWindow, {
      title: $t('pref.setting.backupFileName'),
      properties: ['openFile'],
      filters: [
        { name: 'Snaptium Config', extensions: [SNAPTIUM_CONFIG_EXTENSION] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return false;
    }

    try {
      const importPath = result.filePaths[0];
      const content = await fs.readFile(importPath, 'utf-8');
      const parsed: unknown = JSON.parse(content);
      if (!isSnaptiumConfigPackage(parsed)) {
        throw new Error('Invalid Snaptium config package');
      }

      const nextConfig = normalizeLoggingConfig(mergeConfigWithDefaults(this.getDefaultConfig(), parsed.settings));

      const targetFilePath = this.getSettingsPath();
      await fs.mkdir(path.dirname(targetFilePath), { recursive: true });
      await fs.writeFile(targetFilePath, JSON.stringify(nextConfig, null, 2), 'utf-8');

      if (parsed.e2ee?.keySlots) {
        await keyManagerService.restoreKeySlots(parsed.e2ee.keySlots);
      }

      previewPolicyService.updateConfig(nextConfig);

      return true;
    } catch (error) {
      logger.error('Failed to import settings', { error: getErrorMessage(error) });
      throw error;
    }
  }
};
