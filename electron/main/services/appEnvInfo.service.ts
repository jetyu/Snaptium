import { app } from 'electron';
import { getAppDistribution, type AppDistribution } from '../../shared/updater.constants.js';
import { loggerService } from './logger.service.js';

const logger = loggerService.createLogger('Electron:AppEnvInfo Service');

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
};
