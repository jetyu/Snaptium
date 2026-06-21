import { app, shell } from 'electron';
import { getAppDistribution, type AppDistribution } from '../../shared/updater.constants.js';
import { loggerService } from './logger.service.js';

const logger = loggerService.createLogger('Electron:AppEnvInfo Service');
const MICROSOFT_STORE_URL = 'https://apps.microsoft.com/detail/9p4hw1mddgnn';

export const appEnvInfoService = {
  getAppVersion(): string {
    logger.debug('Getting app version');
    return app.getVersion();
  },

  getEnvVersion(): { electron: string; chrome: string; node: string; v8: string } {
    logger.debug('Getting env version');
    return {
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      v8: process.versions.v8,
    };
  },

  getDistribution(): AppDistribution {
    logger.debug('Getting app distribution');
    return getAppDistribution();
  },

  getAppName(): string {
    logger.debug('Getting app name');
    return app.getName();
  },

  async openStorePage(): Promise<void> {
    logger.debug('Opening Microsoft Store product page');
    await shell.openExternal(MICROSOFT_STORE_URL);
  },
};
