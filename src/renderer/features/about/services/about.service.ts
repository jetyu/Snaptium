import { electronApi, type AppEnvVersion } from '@renderer/core/bridge/electronApi';

export interface AboutInfo {
  appName: string;
  appVersion: string;
  envVersion: AppEnvVersion;
}

function normalizeText(value: string | undefined | null, fallback: string): string {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
}

function normalizeEnvVersion(envVersion: AppEnvVersion): AppEnvVersion {
  return {
    electron: normalizeText(envVersion.electron, 'unknown'),
    node: normalizeText(envVersion.node, 'unknown'),
    chrome: normalizeText(envVersion.chrome, 'unknown'),
    v8: normalizeText(envVersion.v8, 'unknown'),
  };
}

class AboutService {
  onOpenAbout(callback: () => void): () => void {
    return electronApi.menu.onOpenAbout(() => {
      callback();
    });
  }

  async loadAboutInfo(): Promise<AboutInfo> {
    const [appVersion, appName, envVersion] = await Promise.all([
      electronApi.app.getVersion(),
      electronApi.app.getName(),
      electronApi.app.getEnvVersion(),
    ]);

    return {
      appName: normalizeText(appName, 'Unknown App'),
      appVersion: normalizeText(appVersion, '0.0.0'),
      envVersion: normalizeEnvVersion(envVersion),
    };
  }
}

export const aboutService = new AboutService();