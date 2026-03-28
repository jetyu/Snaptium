import { ipcMain } from 'electron';
import { settingsService } from '../../services/settings.service.js';

export function registerSettingsIpcHandlers() {
  /**
   * Handle loading the configuration
   */
  ipcMain.handle('settings:load', async () => {
    return await settingsService.loadConfig();
  });

  /**
   * Handle saving the configuration
   */
  ipcMain.handle('settings:save', async (_event, config) => {
    return await settingsService.saveConfig(config);
  });

  /**
   * Handle setting the auto-launch state
   */
  ipcMain.handle('settings:set-startup', async (_event, enabled) => {
    return await settingsService.setAutoLaunch(enabled);
  });
}
