import { ipcMain } from 'electron';
import { settingsService } from '../../services/settings.service.js';
import { loggerService } from '../../services/logger.service.js';

export function registerSettingsIpcHandlers() {
  /**
   * Handle loading the configuration
   */
  ipcMain.handle('settings:load', async () => {
    const config = await settingsService.loadConfig();
    loggerService.updateConfig(config);
    return config;
  });

  /**
   * Handle saving the configuration
   */
  ipcMain.handle('settings:save', async (_event, config) => {
    const nextConfig = await settingsService.saveConfig(config);
    loggerService.updateConfig(nextConfig);
    return nextConfig;
  });

  /**
   * Handle setting the auto-launch state
   */
  ipcMain.handle('settings:set-startup', async (_event, enabled) => {
    return await settingsService.setAutoLaunch(enabled);
  });
}
