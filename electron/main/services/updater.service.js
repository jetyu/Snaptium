import updaterPkg from 'electron-updater';
const { autoUpdater } = updaterPkg;
import { app } from 'electron';
import { loggerService } from './logger.service.js';
import { settingsService } from './settings.service.js';
import { trayService } from './tray.service.js';
import { UPDATER_CONSTANTS } from '../constants/updater.constants.js';

const logger = loggerService.createLogger('Software Updater');

class UpdaterService {
  constructor() {
    this.mainWindow = null;
    this.updateCheckInterval = null;
    this.isChecking = false;

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    this.setupEventListeners();
  }

  async initialize(mainWindow) {
    this.mainWindow = mainWindow;

    try {
      const config = await settingsService.loadConfig();

      if (config.autoCheckUpdates) {
        this.startAutoCheck(config.updateCheckInterval || UPDATER_CONSTANTS.DEFAULT_CHECK_INTERVAL);
      }

      logger.debug('Updater service initialized');
    } catch (error) {
      logger.error('Failed to initialize updater service', { error: error.message });
    }
  }

  setupEventListeners() {
    autoUpdater.on('checking-for-update', () => {
      logger.debug('Checking for updates...');
      this.isChecking = true;
      this.sendToRenderer('updater:checking');
    });

    autoUpdater.on('update-available', (info) => {
      logger.debug('Update available', { version: info.version });
      this.isChecking = false;
      this.sendToRenderer('updater:available', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes,
        files: info.files,
      });

      trayService.showUpdateNotification(info.version);
    });

    autoUpdater.on('update-not-available', (info) => {
      logger.debug('Update not available', { version: info.version });
      this.isChecking = false;
      this.sendToRenderer('updater:not-available', {
        version: info.version,
      });
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

    autoUpdater.on('error', (error) => {
      logger.error('Update error', { error: error.message });
      this.isChecking = false;

      if (this.latestVersionNotFound(error)) {
        logger.debug('No releases found on GitHub');
        this.sendToRenderer('updater:not-available', { version: app.getVersion() });
        return;
      }

      this.sendToRenderer('updater:error', {
        message: error.message,
        code: error.code || 'UNKNOWN_ERROR',
      });
    });
  }

  latestVersionNotFound(error) {
    const msg = error?.message || '';
    return msg.includes('404') || msg.includes('releases.atom');
  }

  async checkForUpdates(silent = false) {
    if (this.isChecking) {
      logger.warn('Update check already in progress');
      return;
    }

    try {
      logger.debug('Manual update check triggered', { silent });
      this.sendToRenderer('updater:check-start', { silent });
      await autoUpdater.checkForUpdates();
    } catch (error) {
      logger.error('Failed to check for updates', { error: error.message });

      if (this.latestVersionNotFound(error)) {
        logger.debug('No releases version found on GitHub');
        this.sendToRenderer('updater:not-available', { version: app.getVersion() });
        return;
      }

      this.sendToRenderer('updater:error', {
        message: error.message,
        code: 'CHECK_FAILED',
      });
    }
  }

  async downloadUpdate() {
    try {
      logger.debug('Starting update download');
      this.sendToRenderer('updater:download-start');
      await autoUpdater.downloadUpdate();
    } catch (error) {
      logger.error('Failed to download update', { error: error.message });
      this.sendToRenderer('updater:error', {
        message: error.message,
        code: 'DOWNLOAD_FAILED',
      });
    }
  }

  quitAndInstall() {
    logger.debug('Installing update and restarting app');
    autoUpdater.quitAndInstall(false, true);
  }

  startAutoCheck(interval = UPDATER_CONSTANTS.DEFAULT_CHECK_INTERVAL) {
    this.stopAutoCheck();

    logger.debug('Starting auto update check', { interval });

    setTimeout(() => {
      this.checkForUpdates(true);
    }, UPDATER_CONSTANTS.INITIAL_CHECK_DELAY);

    this.updateCheckInterval = setInterval(() => {
      this.checkForUpdates(true);
    }, interval);
  }

  stopAutoCheck() {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
      this.updateCheckInterval = null;
      logger.info('Auto update check stopped');
    }
  }

  async updateConfig(config) {
    if (config.autoCheckUpdates) {
      this.startAutoCheck(config.updateCheckInterval || UPDATER_CONSTANTS.DEFAULT_CHECK_INTERVAL);
    } else {
      this.stopAutoCheck();
    }
  }

  getCurrentVersion() {
    return app.getVersion();
  }

  sendToRenderer(channel, data = {}) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  destroy() {
    this.stopAutoCheck();
    this.mainWindow = null;
  }
}

export const updaterService = new UpdaterService();
