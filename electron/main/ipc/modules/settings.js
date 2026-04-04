import { ipcMain, app } from 'electron';
import { settingsService } from '../../services/settings.service.js';
import { loggerService } from '../../services/logger.service.js';
import { IPC_CHANNELS } from '../../constants/ipc.constants.js';

const logger = loggerService.createLogger('Electron:Settings IPC');

export function registerSettingsIpcHandlers() {
  /**
   * Handle loading the configuration
   */
  ipcMain.handle(IPC_CHANNELS.SETTINGS_LOAD, async () => {
    const config = await settingsService.loadConfig();
    loggerService.updateConfig(config);
    logger.debug('Settings loaded');
    return config;
  });

  /**
   * Handle saving the configuration
   */
  ipcMain.handle(IPC_CHANNELS.SETTINGS_SAVE, async (_event, config) => {
    const nextConfig = await settingsService.saveConfig(config);
    loggerService.updateConfig(nextConfig);
    logger.debug('Settings saved');
    return nextConfig;
  });

  /**
   * Handle setting the auto-launch state
   */
  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET_STARTUP, async (_event, enabled) => {
    logger.debug('Settings set startup');
    return await settingsService.setAutoLaunch(enabled);
  });

  /**
   * Handle picking a directory
   */
  ipcMain.handle(IPC_CHANNELS.SETTINGS_PICK_DIRECTORY, async () => {
    logger.debug('Settings pick directory');
    return await settingsService.pickDirectory();
  });

  /**
   * Handle exporting settings
   */
  ipcMain.handle(IPC_CHANNELS.SETTINGS_EXPORT, async () => {
    logger.debug('Settings export');
    return await settingsService.exportConfig();
  });

  /**
   * Handle importing settings
   */
  ipcMain.handle(IPC_CHANNELS.SETTINGS_IMPORT, async () => {
    logger.debug('Settings import');
    const result = await settingsService.importConfig();
    if (result) {
      app.relaunch();
      app.exit(0);
    }
    return result;
  });
}
