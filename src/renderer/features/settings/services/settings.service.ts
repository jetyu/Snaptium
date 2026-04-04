import { electronApi } from '@renderer/core/bridge/electronApi';

/**
 * Renderer-side settings service.
 * Delegates all calls to the main process via the preload bridge.
 * Type safety is provided by the global Window augmentation in electron.d.ts.
 */
export const settingsService = {
  onOpenPreferences: (callback: () => void): (() => void) =>
    electronApi.menu.onOpenPreferences(callback),

  testConnection: (config: { aiEndpoint: string; aiApiKey: string; aiModel: string }): Promise<{ success: boolean; message?: string }> =>
    electronApi.aiSource.testConnection(config),

  openLogDir: (): Promise<boolean | undefined> =>
    electronApi.logger.openDir(),

  loadConfig: (): Promise<Record<string, unknown>> =>
    electronApi.settings.getConfig(),

  async saveConfig(config: Record<string, unknown>): Promise<Record<string, unknown>> {
    const saved = await electronApi.settings.saveConfig(config);
    notifySettingsChanged();
    return saved;
  },

  setStartup: (enabled: boolean): Promise<{ enabled: boolean; supported: boolean }> =>
    electronApi.settings.setStartup(enabled),

  notifyLanguageChanged: (locale: string): void =>
    electronApi.settings.switchLanguage(locale),

  pickDirectory: (): Promise<string | null> =>
    electronApi.settings.pickDirectory(),

  exportConfig: (): Promise<boolean> =>
    electronApi.settings.exportConfig(),

  importConfig: (): Promise<boolean> =>
    electronApi.settings.importConfig(),
};

/**
 * Notify the renderer process that the application settings have changed.
 */
function notifySettingsChanged() {
  window.dispatchEvent(new CustomEvent('settings-changed'));
}
