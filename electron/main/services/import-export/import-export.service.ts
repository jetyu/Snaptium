import { settingsService } from '../settings.service.js';
import { loggerService } from '../logger.service.js';
import { sppxExportService } from './sppx-export.service.js';
import { sppxImportService } from './sppx-import.service.js';
import { markdownExportService } from './markdown-export.service.js';
import { markdownImportService } from './markdown-import.service.js';
import { getErrorMessage } from '../../utils/error.utils.js';

const logger = loggerService.createLogger('Main:Import Export Service');
type AppSettings = Awaited<ReturnType<typeof settingsService.loadConfig>>;

async function saveSettingsPartial(
  updateBuilder: (config: AppSettings) => AppSettings,
): Promise<void> {
  const currentConfig = await settingsService.loadConfig();
  const nextConfig = updateBuilder(currentConfig);
  await settingsService.saveConfig(nextConfig);
}

export const importExportService = {
  async exportSppxPackage() {
    const result = await sppxExportService.exportPackage();
    if (!result?.success || result.cancelled) {
      return result;
    }

    await saveSettingsPartial((config: AppSettings) => ({
      ...config,
      lastSppxExportAt: result.exportedAt,
      lastSppxExportPath: result.filePath,
    })).catch((error) => {
      logger.warn(`Failed to persist SPPX export history: ${getErrorMessage(error)}`);
    });

    return result;
  },

  async importSppxPackage() {
    const result = await sppxImportService.importPackage();
    if (!result?.success || result.cancelled) {
      return result;
    }

    await saveSettingsPartial((config: AppSettings) => ({
      ...config,
      lastSppxImportAt: result.importedAt,
      rag: {
        ...config.rag,
        lastIndexedAt: null,
      },
      sync: {
        ...config.sync,
        lastSyncedAt: null,
      },
    })).catch((error) => {
      logger.warn(`Failed to persist SPPX import history: ${getErrorMessage(error)}`);
    });

    return result;
  },

  async exportMarkdownBatch() {
    const result = await markdownExportService.exportMarkdown();
    if (!result?.success || result.cancelled || !result.directoryPath) {
      return result;
    }

    await saveSettingsPartial((config: AppSettings) => ({
      ...config,
      lastMarkdownExportDir: result.directoryPath,
    })).catch((error) => {
      logger.warn(`Failed to persist markdown export history: ${getErrorMessage(error)}`);
    });

    return result;
  },

  async importMarkdownBatch() {
    const result = await markdownImportService.importMarkdown();
    if (!result?.success || result.cancelled || !result.directoryPath) {
      return result;
    }

    await saveSettingsPartial((config: AppSettings) => ({
      ...config,
      lastMarkdownImportDir: result.directoryPath,
    })).catch((error) => {
      logger.warn(`Failed to persist markdown import history: ${getErrorMessage(error)}`);
    });

    return result;
  },
};
