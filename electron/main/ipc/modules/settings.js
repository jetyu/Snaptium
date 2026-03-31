import { ipcMain } from 'electron';
import { settingsService } from '../../services/settings.service.js';
import { loggerService } from '../../services/logger.service.js';
import { IPC_CHANNELS } from '../../constants/ipc.constants.js';

export function registerSettingsIpcHandlers() {
  /**
   * Handle loading the configuration
   */
  ipcMain.handle(IPC_CHANNELS.SETTINGS_LOAD, async () => {
    const config = await settingsService.loadConfig();
    loggerService.updateConfig(config);
    return config;
  });

  /**
   * Handle saving the configuration
   */
  ipcMain.handle(IPC_CHANNELS.SETTINGS_SAVE, async (_event, config) => {
    const nextConfig = await settingsService.saveConfig(config);
    loggerService.updateConfig(nextConfig);
    return nextConfig;
  });

  /**
   * Handle setting the auto-launch state
   */
  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET_STARTUP, async (_event, enabled) => {
    return await settingsService.setAutoLaunch(enabled);
  });

  /**
   * Handle picking a directory
   */
  ipcMain.handle(IPC_CHANNELS.SETTINGS_PICK_DIRECTORY, async () => {
    return await settingsService.pickDirectory();
  });
}
