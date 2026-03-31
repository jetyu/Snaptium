import { app } from 'electron';

export const appEnvInfoService = {
  
  getAppVersion() {
    return app.getVersion();
  },

  getEnvVersion() {
    return {
      electron: process.versions.electron ,
      chrome: process.versions.chrome,
      node: process.versions.node,
      v8: process.versions.v8,
    };
  },

  getAppName() {
    return app.getName();
  },
};
