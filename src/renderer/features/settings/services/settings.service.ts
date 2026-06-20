import {
  electronApi,
  type JsonObject,
  type MarkdownExportResult,
  type MarkdownImportResult,
  type MessageDialogOptions,
  type RagRebuildMode,
  type SppxExportResult,
  type SppxImportResult,
} from '@renderer/core/bridge/electronApi';
import {
  APP_SHELL_DEFAULT_MAIN_VIEW,
  APP_SHELL_MAX_CUSTOM_MODULES,
  normalizeAppShellMainViewId,
} from '@renderer/app/constants/appShell.constants';
import { switchLanguage } from '@renderer/features/i18n';
import { sanitizeWorkbenchSettings } from '@renderer/features/workbench/constants/workbench.constants';
import { normalizeTrustedRemoteImageHosts } from '@shared/preview-security.constants';
import type { AppSettings, AISource } from '../store/settings.store';

type SettingsChangeReason = 'save' | 'language' | 'import' | 'reset';

export interface AiConnectionPayload {
  aiBaseUrl: string;
  aiApiKey: string;
  aiModel: string;
  capabilities: string[];
}

function normalizeAiSources(value: unknown): AISource[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((source) => {
    const normalized = (source ?? {}) as Partial<AISource>;
    const capabilities = Array.isArray(normalized.capabilities)
      ? normalized.capabilities.filter((capability): capability is string => typeof capability === 'string')
      : [];

    return {
      id: String(normalized.id ?? ''),
      name: String(normalized.name ?? ''),
      baseUrl: String(normalized.baseUrl ?? ''),
      apiKey: String(normalized.apiKey ?? ''),
      aiModel: String(normalized.aiModel ?? ''),
      capabilities,
    };
  });
}

function mergeConfig(baseConfig: AppSettings, incomingConfig?: Partial<AppSettings> | null): AppSettings {
  if (!incomingConfig) {
    return {
      ...baseConfig,
      aiSources: normalizeAiSources(baseConfig.aiSources),
      aiAssistant: { ...baseConfig.aiAssistant },
      previewAppearance: { ...baseConfig.previewAppearance },
      rag: { ...baseConfig.rag },
      sync: {
        ...baseConfig.sync,
        webdav: { ...baseConfig.sync.webdav },
        ossS3: { ...baseConfig.sync.ossS3 },
      },
      appShell: {
        ...baseConfig.appShell,
        customSidebarModules: [...baseConfig.appShell.customSidebarModules],
        maxCustomSidebarModules: APP_SHELL_MAX_CUSTOM_MODULES,
      },
      workbench: sanitizeWorkbenchSettings(baseConfig.workbench),
    };
  }

  const isLegacyShellConfig = !incomingConfig.workbench;
  const fallbackMainView = isLegacyShellConfig
    ? APP_SHELL_DEFAULT_MAIN_VIEW
    : baseConfig.appShell.activeMainView;

  return {
    ...baseConfig,
    ...incomingConfig,
    aiSources: normalizeAiSources(incomingConfig.aiSources ?? baseConfig.aiSources),
    aiAssistant: {
      ...baseConfig.aiAssistant,
      ...(incomingConfig.aiAssistant ?? {}),
    },
    previewAppearance: {
      ...baseConfig.previewAppearance,
      ...(incomingConfig.previewAppearance ?? {}),
      trustedRemoteImageHosts: normalizeTrustedRemoteImageHosts(
        incomingConfig.previewAppearance?.trustedRemoteImageHosts ?? baseConfig.previewAppearance.trustedRemoteImageHosts,
      ),
    },
    rag: {
      ...baseConfig.rag,
      ...(incomingConfig.rag ?? {}),
    },
    sync: {
      ...baseConfig.sync,
      ...(incomingConfig.sync ?? {}),
      webdav: {
        ...baseConfig.sync.webdav,
        ...(incomingConfig.sync?.webdav ?? {}),
      },
      ossS3: {
        ...baseConfig.sync.ossS3,
        ...(incomingConfig.sync?.ossS3 ?? {}),
      },
    },
    appShell: {
      ...baseConfig.appShell,
      ...(incomingConfig.appShell ?? {}),
      activeMainView: normalizeAppShellMainViewId(
        incomingConfig.appShell?.activeMainView,
        fallbackMainView,
      ),
      customSidebarModules: Array.isArray(incomingConfig.appShell?.customSidebarModules)
        ? [...incomingConfig.appShell.customSidebarModules]
        : [...baseConfig.appShell.customSidebarModules],
      maxCustomSidebarModules: APP_SHELL_MAX_CUSTOM_MODULES,
    },
    workbench: sanitizeWorkbenchSettings({
      ...baseConfig.workbench,
      ...(incomingConfig.workbench ?? {}),
    }),
  };
}

function cloneConfig(config: AppSettings): JsonObject {
  return JSON.parse(JSON.stringify(config)) as JsonObject;
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
    aiBaseUrl: selectedSource?.baseUrl ?? '',
    aiApiKey: selectedSource?.apiKey ?? '',
    aiModel: config.aiAssistant.model,
    capabilities: selectedSource?.capabilities ?? ['chat'],
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

  async confirmRagRebuildMode(): Promise<RagRebuildMode> {
    return await electronApi.settings.confirmRagRebuildMode();
  },

  async confirmDeleteAiSource(name: string): Promise<boolean> {
    return await electronApi.settings.confirmDeleteAiSource(name);
  },

  async confirmResetSyncProvider(name: string): Promise<boolean> {
    return await electronApi.settings.confirmResetSyncProvider(name);
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

  async showMessageDialog(options: MessageDialogOptions): Promise<boolean> {
    return await electronApi.settings.showMessage(options);
  },

  async exportSppxPackage(): Promise<SppxExportResult> {
    return await electronApi.dataTransfer.exportSppx();
  },

  async importSppxPackage(): Promise<SppxImportResult> {
    return await electronApi.dataTransfer.importSppx();
  },

  async exportMarkdownBatch(): Promise<MarkdownExportResult> {
    return await electronApi.dataTransfer.exportMarkdown();
  },

  async importMarkdownBatch(): Promise<MarkdownImportResult> {
    return await electronApi.dataTransfer.importMarkdown();
  },
};
