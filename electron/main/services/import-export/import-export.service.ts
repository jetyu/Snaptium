import { settingsService } from '../settings.service.js';
import { loggerService } from '../logger.service.js';
import { sppxExportService } from './sppx-export.service.js';
import { sppxImportService } from './sppx-import.service.js';
import { markdownExportService } from './markdown-export.service.js';
import { markdownImportService } from './markdown-import.service.js';
import { getErrorMessage } from '../../services/error.service.js';

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
    return result;
  },

  async importSppxPackage() {
    const result = await sppxImportService.importPackage();
    if (!result?.success || result.cancelled) {
      return result;
    }

    await saveSettingsPartial((config: AppSettings) => ({
      ...config,
      rag: {
        ...config.rag,
        lastIndexedAt: null,
      },
      sync: {
        ...config.sync,
        lastSyncedAt: null,
      },
    })).catch((error) => {
      logger.warn(`Failed to reset post-import sync/index metadata: ${getErrorMessage(error)}`);
    });

    return result;
  },

  async exportMarkdownBatch() {
    return await markdownExportService.exportMarkdown();
  },

  async importMarkdownBatch() {
    return await markdownImportService.importMarkdown();
  },
};
