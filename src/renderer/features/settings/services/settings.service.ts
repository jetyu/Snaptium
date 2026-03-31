/**
 * Renderer-side settings service.
 * Delegates all calls to the main process via the preload bridge.
 * Type safety is provided by the global Window augmentation in electron.d.ts.
 */
export const settingsService = {
  loadConfig: (): Promise<Record<string, unknown>> =>
    window.electronAPI.settings?.getConfig() ?? Promise.resolve({}),

  saveConfig: (config: Record<string, unknown>): Promise<Record<string, unknown>> =>
    window.electronAPI.settings?.saveConfig(config) ?? Promise.resolve(config),

  setStartup: (enabled: boolean): Promise<{ enabled: boolean; supported: boolean }> =>
    window.electronAPI.settings?.setStartup(enabled) ?? Promise.resolve({ enabled, supported: false }),

  notifyLanguageChanged: (locale: string): void =>
    window.electronAPI.settings?.switchLanguage(locale),

  pickDirectory: (): Promise<string | null> =>
    window.electronAPI.settings?.pickDirectory() ?? Promise.resolve(null),
};
