export const settingsService = {
  /**
   * Load the application configuration preferences
   */
  loadConfig: async (): Promise<Record<string, any>> => {
    const api = (window as Window & {
      electronAPI?: {
        settings?: {
          getConfig?: () => Promise<Record<string, any>>;
          pickDirectory?: () => Promise<string | null>;
        };
      };
    }).electronAPI;

    return await api?.settings?.getConfig?.() || {};
  },

  /**
   * Save the application configuration preferences natively
   */
  saveConfig: async (config: Record<string, any>): Promise<Record<string, any>> => {
    const api = (window as Window & {
      electronAPI?: {
        settings?: {
          saveConfig?: (nextConfig: Record<string, any>) => Promise<Record<string, any>>;
        };
      };
    }).electronAPI;

    return await api?.settings?.saveConfig?.(config) || config;
  },

  setStartup: async (enabled: boolean): Promise<{ enabled: boolean; supported: boolean }> => {
    const api = (window as Window & {
      electronAPI?: {
        settings?: {
          setStartup?: (nextEnabled: boolean) => Promise<{ enabled: boolean; supported: boolean }>;
        };
      };
    }).electronAPI;

    return await api?.settings?.setStartup?.(enabled) || { enabled, supported: false };
  },

  notifyLanguageChanged: (locale: string): void => {
    const api = (window as Window & {
      electronAPI?: {
        settings?: {
          switchLanguage?: (nextLocale: string) => void;
        };
      };
    }).electronAPI;

    api?.settings?.switchLanguage?.(locale);
  },

  pickDirectory: async (): Promise<string | null> => {
    const api = (window as Window & {
      electronAPI?: {
        settings?: {
          pickDirectory?: () => Promise<string | null>;
        };
      };
    }).electronAPI;

    return (await api?.settings?.pickDirectory?.()) || null;
  },
};
