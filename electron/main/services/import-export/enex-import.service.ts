import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import { BrowserWindow, dialog, type OpenDialogOptions } from 'electron';
import { OutputFormat } from 'yarle-evernote-to-md/dist/output-format.js';
import type { YarleOptions } from 'yarle-evernote-to-md/dist/YarleOptions.js';
import { $t } from '../../utils/i18n.js';
import { loggerService } from '../logger.service.js';
import { markdownImportService } from './markdown-import.service.js';
import { getErrorMessage } from '../../services/error.service.js';

const logger = loggerService.createLogger('Main:ENEX Import Service');

function getFocusedWindow(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;
}

export const enexImportService = {
  async importEnex() {
    const focusedWindow = getFocusedWindow();
    const openDialogOptions: OpenDialogOptions = {
      title: $t('dataTransfer.enexImport.dialogTitle'),
      filters: [{ name: 'Evernote Export Files', extensions: ['enex'] }],
      properties: ['openFile'],
    };

    const openDialogResult = focusedWindow
      ? await dialog.showOpenDialog(focusedWindow, openDialogOptions)
      : await dialog.showOpenDialog(openDialogOptions);

    if (openDialogResult.canceled || openDialogResult.filePaths.length === 0) {
      return {
        success: false,
        cancelled: true,
      };
    }

    // Import from the core yarle file specifically to avoid side effects 
    // from the package's main script (dist/ui/main.js) which tries to 
    // launch a new Electron application.
    const yarle = await import('yarle-evernote-to-md/dist/yarle.js');
    const dropTheRope = yarle.dropTheRope || yarle.default?.dropTheRope;

    if (!dropTheRope) {
      throw new Error('Failed to load yarle conversion engine');
    }

    const enexFilePath = openDialogResult.filePaths[0];
    const tempDir = path.join(os.tmpdir(), `notewizard-enex-import-${crypto.randomBytes(4).toString('hex')}`);

    try {
      await fs.mkdir(tempDir, { recursive: true });

      // Configure Yarle
      const options: YarleOptions = {
        enexSources: [enexFilePath],
        outputDir: tempDir,
        isMetadataNeeded: true,
        pathSeparator: path.sep,
        nestedTags: {
          separatorInEN: '_', // Note: Yarle's option name for nested tags separator in ENEX
          replaceSeparatorWith: '/',
          replaceSpaceWith: '-',
        },
        templateFile: undefined,
        outputFormat: OutputFormat.ObsidianMD,
        skipCreationTime: false,
        skipUpdateTime: false,
        skipWebClips: false,
      };

      logger.info(`Starting ENEX conversion for ${enexFilePath} into ${tempDir}`);
      await dropTheRope(options);

      logger.info('ENEX conversion completed, starting directory import');

      // The output from Yarle is usually in a subfolder named after the enex file or "Notes"
      // We'll just point to the tempDir and let markdownImportService handle it
      const result = await markdownImportService.importDirectory(tempDir);

      return result;
    } catch (error) {
      logger.error(`ENEX import failed: ${getErrorMessage(error)}`);
      throw error;
    } finally {
      // Cleanup temp directory
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
        logger.info(`Cleaned up temp directory: ${tempDir}`);
      } catch (cleanupError) {
        logger.warn(`Failed to cleanup temp directory ${tempDir}: ${getErrorMessage(cleanupError)}`);
      }
    }
  },
};
