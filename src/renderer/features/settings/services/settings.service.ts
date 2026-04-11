import { electronApi } from '@renderer/core/bridge/electronApi';
import { switchLanguage } from '@renderer/features/i18n';
import type { AppSettings, AISource } from '../store/settings.store';

type SettingsChangeReason = 'save' | 'language' | 'import' | 'reset';

export interface AiConnectionPayload {
  aiEndpoint: string;
  aiApiKey: string;
  aiModel: string;
}

function normalizeAiSources(value: unknown): AISource[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((source) => {
    const normalized = (source ?? {}) as Partial<AISource>;
    return {
      id: String(normalized.id ?? ''),
      name: String(normalized.name ?? ''),
      endpoint: String(normalized.endpoint ?? ''),
      apiKey: String(normalized.apiKey ?? ''),
      aiModel: String(normalized.aiModel ?? ''),
    };
  });
}

function mergeConfig(baseConfig: AppSettings, incomingConfig?: Partial<AppSettings> | null): AppSettings {
  if (!incomingConfig) {
    return {
      ...baseConfig,
      aiSources: normalizeAiSources(baseConfig.aiSources),
      aiAssistant: { ...baseConfig.aiAssistant },
      rag: { ...baseConfig.rag },
    };
  }

  return {
    ...baseConfig,
    ...incomingConfig,
    aiSources: normalizeAiSources(incomingConfig.aiSources ?? baseConfig.aiSources),
    aiAssistant: {
      ...baseConfig.aiAssistant,
      ...(incomingConfig.aiAssistant ?? {}),
    },
    rag: {
      ...baseConfig.rag,
      ...(incomingConfig.rag ?? {}),
    },
  };
}

function cloneConfig(config: AppSettings): Record<string, unknown> {
  return JSON.parse(JSON.stringify(config)) as Record<string, unknown>;
}

function dispatchSettingsChanged(reason: SettingsChangeReason) {
  window.dispatchEvent(new CustomEvent('settings-changed', { detail: { reason } }));
}

function buildAiConnectionPayload(config: AppSettings, override?: AiConnectionPayload): AiConnectionPayload {
  if (override) {
    return override;
  }

  const selectedSource = config.aiSources.find((source) => source.id === config.aiAssistant.sourceId);
  return {
    aiEndpoint: selectedSource?.endpoint ?? '',
    aiApiKey: selectedSource?.apiKey ?? '',
    aiModel: config.aiAssistant.model,
  };
}

function normalizeDirectory(path: string | null): string | null {
  const normalized = path?.trim();
  return normalized ? normalized : null;
}

async function loadMergedConfig(defaultConfig: AppSettings): Promise<AppSettings> {
  const savedConfig = await electronApi.settings.getConfig() as Partial<AppSettings> | null;
  const mergedConfig = mergeConfig(defaultConfig, savedConfig);
  mergedConfig.language = await switchLanguage(mergedConfig.language);
  return mergedConfig;
}

export const settingsService = {
  onOpenPreferences(callback: () => void): () => void {
    return electronApi.menu.onOpenPreferences(() => {
      callback();
    });
  },

  async loadConfig(defaultConfig: AppSettings): Promise<AppSettings> {
    return await loadMergedConfig(defaultConfig);
  },

  async saveConfig(config: AppSettings): Promise<AppSettings> {
    const savedConfig = await electronApi.settings.saveConfig(cloneConfig(config)) as Partial<AppSettings>;
    const mergedConfig = mergeConfig(config, savedConfig);
    dispatchSettingsChanged('save');
    return mergedConfig;
  },

  async changeLanguage(language: string): Promise<string> {
    const nextLanguage = await switchLanguage(language);
    await electronApi.settings.switchLanguage(nextLanguage);
    dispatchSettingsChanged('language');
    return nextLanguage;
  },

  async setStartup(enabled: boolean): Promise<{ enabled: boolean; supported: boolean }> {
    const result = await electronApi.settings.setStartup(enabled);
    return {
      enabled: Boolean(result.enabled),
      supported: Boolean(result.supported),
    };
  },

  async testConnection(config: AppSettings, override?: AiConnectionPayload): Promise<{ success: boolean; message?: string }> {
    return await electronApi.aiSource.testConnection(buildAiConnectionPayload(config, override));
  },

  async openLogDir(): Promise<boolean | undefined> {
    return await electronApi.logger.openDir();
  },

  async pickDirectory(): Promise<string | null> {
    return normalizeDirectory(await electronApi.settings.pickDirectory());
  },

  async confirmEmbeddingSourceChange(currentSourceId: string, nextSourceId: string): Promise<boolean> {
    if (!nextSourceId || currentSourceId === nextSourceId) {
      return true;
    }

    return await electronApi.settings.confirmEmbeddingSourceChange();
  },

  async exportConfig(): Promise<boolean> {
    return await electronApi.settings.exportConfig();
  },

  async importConfig(defaultConfig: AppSettings): Promise<AppSettings | null> {
    const imported = await electronApi.settings.importConfig();
    if (!imported) {
      return null;
    }

    const mergedConfig = await loadMergedConfig(defaultConfig);
    dispatchSettingsChanged('import');
    return mergedConfig;
  },

  async resetConfig(defaultConfig: AppSettings): Promise<AppSettings | null> {
    const reset = await electronApi.settings.resetConfig();
    if (!reset) {
      return null;
    }

    const mergedConfig = await loadMergedConfig(defaultConfig);
    dispatchSettingsChanged('reset');
    return mergedConfig;
  },
};