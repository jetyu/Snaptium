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
  async getAppVersion(): Promise<string> {
    return await window.electronAPI.app.getVersion();
  }

  async getAppName(): Promise<string> {
    return await window.electronAPI.app.getName();
  }

  async getEnvVersion(): Promise<EnvVersionInfo> {
    return await window.electronAPI.app.getEnvVersion();
  }
}

export const aboutService = new AboutService();
