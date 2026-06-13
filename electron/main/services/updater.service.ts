import updaterPkg from 'electron-updater';
const { autoUpdater } = updaterPkg;
import { CancellationToken } from 'builder-util-runtime';
import { app, BrowserWindow } from 'electron';
import {
  buildUpdateFeedUrl,
  resolveUpdateTargetChannel,
  type UpdateChannel,
} from '../../shared/updater.constants.js';
import { loggerService } from './logger.service.js';
import { settingsService } from './settings.service.js';
import { trayService } from './tray.service.js';
import { UPDATER_CONSTANTS } from '../constants/updater.constants.js';
import { getErrorCode, getErrorMessage } from '../services/error.service.js';

const logger = loggerService.createLogger('Software Updater');

class UpdaterService {
  private mainWindow: BrowserWindow | null;
  private updateCheckInterval: ReturnType<typeof setInterval> | null;
  private initialCheckTimeout: ReturnType<typeof setTimeout> | null;
  private downloadCancellationToken: CancellationToken | null;
  private isChecking: boolean;
  private currentCheckSilent: boolean;

  constructor() {
    this.mainWindow = null;
    this.updateCheckInterval = null;
    this.initialCheckTimeout = null;
    this.downloadCancellationToken = null;
    this.isChecking = false;
    this.currentCheckSilent = false;

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    this.setupEventListeners();
  }

  async initialize(mainWindow: BrowserWindow): Promise<void> {
    this.mainWindow = mainWindow;

    try {
      const config = await settingsService.loadConfig();
      this.applyUpdateSource(config.updateChannel);

      if (config.autoCheckUpdates) {
        this.startAutoCheck(config.updateCheckInterval || UPDATER_CONSTANTS.DEFAULT_CHECK_INTERVAL);
      }

      logger.debug('Updater service initialized');
    } catch (error: unknown) {
      logger.error('Failed to initialize updater service', { error: getErrorMessage(error) });
    }
  }

  private applyUpdateSource(channel: UpdateChannel): void {
    const targetChannel = resolveUpdateTargetChannel(channel);
    const feedUrl = buildUpdateFeedUrl(channel);

    autoUpdater.channel = targetChannel;
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: feedUrl,
    });

    logger.debug('Configured update feed', {
      channel,
      targetChannel,
      feedUrl,
    });
  }

  setupEventListeners(): void {
    autoUpdater.on('checking-for-update', () => {
      logger.debug('Checking for updates...');
      this.isChecking = true;
      this.sendToRenderer('updater:checking', { silent: this.currentCheckSilent });
    });

    autoUpdater.on('update-available', (info) => {
      logger.debug('Update available', { version: info.version });
      const silent = this.currentCheckSilent;
      this.isChecking = false;
      this.sendToRenderer('updater:available', {
        silent,
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes,
        files: info.files,
      });

      trayService.showUpdateNotification(info.version);
      this.currentCheckSilent = false;
    });

    autoUpdater.on('update-not-available', (info) => {
      logger.debug('Update not available', { version: info.version });
      const silent = this.currentCheckSilent;
      this.isChecking = false;
      this.sendToRenderer('updater:not-available', {
        silent,
        version: info.version,
      });
      this.currentCheckSilent = false;
    });

    autoUpdater.on('download-progress', (progressObj) => {
      this.sendToRenderer('updater:download-progress', {
        percent: progressObj.percent,
        bytesPerSecond: progressObj.bytesPerSecond,
        transferred: progressObj.transferred,
        total: progressObj.total,
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      logger.debug('Update downloaded', { version: info.version });
      this.sendToRenderer('updater:downloaded', {
        version: info.version,
        releaseNotes: info.releaseNotes,
      });
    });

    autoUpdater.on('update-cancelled', (info) => {
      logger.debug('Update download cancelled', { version: info.version });
      this.sendToRenderer('updater:download-cancelled', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes,
        files: info.files,
      });
    });

    autoUpdater.on('error', (error: unknown) => {
      logger.error('Update error', { error: getErrorMessage(error) });
      const silent = this.currentCheckSilent;
      this.isChecking = false;

      if (this.latestVersionNotFound(error)) {
        logger.debug('No releases found on GitHub');
        this.sendToRenderer('updater:not-available', { silent, version: app.getVersion() });
        this.currentCheckSilent = false;
        return;
      }

      this.sendToRenderer('updater:error', {
        silent,
        message: getErrorMessage(error),
        code: getErrorCode(error) ?? 'UNKNOWN_ERROR',
      });
      this.currentCheckSilent = false;
    });
  }

  latestVersionNotFound(error: unknown): boolean {
    const msg = getErrorMessage(error, '');
    return msg.includes('404') || msg.includes('releases.atom');
  }

  async checkForUpdates(silent = false): Promise<void> {
    if (this.isChecking) {
      logger.warn('Update check already in progress');
      return;
    }

    try {
      logger.debug('Update check triggered', { silent });
      this.currentCheckSilent = silent;
      this.sendToRenderer('updater:check-start', { silent });
      await autoUpdater.checkForUpdates();
    } catch (error: unknown) {
      logger.error('Failed to check for updates', { error: getErrorMessage(error) });

      if (this.latestVersionNotFound(error)) {
        logger.debug('No releases version found on GitHub');
        this.sendToRenderer('updater:not-available', { silent: this.currentCheckSilent, version: app.getVersion() });
        this.currentCheckSilent = false;
        return;
      }

      this.sendToRenderer('updater:error', {
        silent: this.currentCheckSilent,
        message: getErrorMessage(error),
        code: 'CHECK_FAILED',
      });
      this.currentCheckSilent = false;
    }
  }

  async downloadUpdate(): Promise<void> {
    if (this.downloadCancellationToken) {
      logger.warn('Update download already in progress');
      return;
    }

    this.downloadCancellationToken = new CancellationToken();

    try {
      logger.debug('Starting update download');
      this.sendToRenderer('updater:download-start');
      await autoUpdater.downloadUpdate(this.downloadCancellationToken);
    } catch (error: unknown) {
      if (this.isDownloadCancelled(error)) {
        logger.info('Update download cancelled');
        return;
      }

      logger.error('Failed to download update', { error: getErrorMessage(error) });
      this.sendToRenderer('updater:error', {
        message: getErrorMessage(error),
        code: 'DOWNLOAD_FAILED',
      });
    } finally {
      this.clearDownloadCancellationToken();
    }
  }

  cancelDownload(): void {
    if (!this.downloadCancellationToken) {
      logger.debug('No update download to cancel');
      return;
    }

    logger.debug('Cancelling update download');
    this.downloadCancellationToken.cancel();
  }

  quitAndInstall(): void {
    logger.debug('Installing update and restarting app');
    autoUpdater.quitAndInstall(false, true);
  }

  startAutoCheck(interval = UPDATER_CONSTANTS.DEFAULT_CHECK_INTERVAL): void {
    this.stopAutoCheck();

    logger.debug('Starting auto update check', { interval });

    this.initialCheckTimeout = setTimeout(() => {
      this.checkForUpdates(true);
    }, UPDATER_CONSTANTS.INITIAL_CHECK_DELAY);

    this.updateCheckInterval = setInterval(() => {
      this.checkForUpdates(true);
    }, interval);
  }

  stopAutoCheck(): void {
    if (this.initialCheckTimeout) {
      clearTimeout(this.initialCheckTimeout);
      this.initialCheckTimeout = null;
    }

    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
      this.updateCheckInterval = null;
      logger.info('Auto update check stopped');
    }
  }

  async updateConfig(config: { autoCheckUpdates: boolean; updateCheckInterval: number; updateChannel: UpdateChannel }): Promise<void> {
    this.applyUpdateSource(config.updateChannel);

    if (config.autoCheckUpdates) {
      this.startAutoCheck(config.updateCheckInterval || UPDATER_CONSTANTS.DEFAULT_CHECK_INTERVAL);
    } else {
      this.stopAutoCheck();
    }
  }

  getCurrentVersion(): string {
    return app.getVersion();
  }

  sendToRenderer(channel: string, data: unknown = {}): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  destroy(): void {
    this.stopAutoCheck();
    this.clearDownloadCancellationToken();
    this.mainWindow = null;
    this.currentCheckSilent = false;
  }

  private clearDownloadCancellationToken(): void {
    this.downloadCancellationToken?.dispose();
    this.downloadCancellationToken = null;
  }

  private isDownloadCancelled(error: unknown): boolean {
    return getErrorMessage(error, '') === 'cancelled';
  }
}

export const updaterService = new UpdaterService();
