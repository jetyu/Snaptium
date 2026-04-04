import { electronApi } from '@renderer/core/bridge/electronApi';

export interface AppVersionInfo {
  appVersion: string;
  appName: string;
}

export interface EnvVersionInfo {
  electron: string;
  node: string;
  chrome: string;
  v8: string;
}

export class AboutService {
  onOpenAbout(callback: () => void): () => void {
    return electronApi.menu.onOpenAbout(callback);
  }

  async getAppVersion(): Promise<string> {
    return await electronApi.app.getVersion();
  }

  async getAppName(): Promise<string> {
    return await electronApi.app.getName();
  }

  async getEnvVersion(): Promise<EnvVersionInfo> {
    return await electronApi.app.getEnvVersion();
  }
}

export const aboutService = new AboutService();
