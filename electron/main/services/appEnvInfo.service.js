import { app } from 'electron';
import { loggerService } from './logger.service.js';

const logger = loggerService.createLogger('Electron:AppEnvInfo Service');

export const appEnvInfoService = {
  getAppVersion() {
    logger.debug('Getting app version');
    return app.getVersion();
  },

  getEnvVersion() {
    logger.debug('Getting env version');
    return {
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      v8: process.versions.v8,
    };
  },

  getAppName() {
    logger.debug('Getting app name');
    return app.getName();
  },
};
