import path from 'node:path';
import { promises as fs } from 'node:fs';
import { app, BrowserWindow, dialog } from 'electron';
import { $t } from '../../utils/i18n.js';
import { VFS_CONSTANTS } from '../../constants/vfs.constants.js';
import { loggerService } from '../logger.service.js';
import { vfsService } from '../vfs.service.js';
import { createZipArchiveFromDirectory } from './zip.utils.js';
import { getErrorMessage } from '../../services/error.service.js';

const logger = loggerService.createLogger('Main:SPPX Export Service');
const PACKAGE_EXTENSIONS = new Set(['.nwp', '.sppx']);
const DEFAULT_EXTENSION = '.sppx';

interface SppxExportResult {
  success: boolean;
  cancelled: boolean;
  filePath?: string;
  exportedAt?: number;
}

function getFocusedWindow(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;
}

function formatDatePart(date: number): string {
  const value = Number(date);
  return value < 10 ? `0${value}` : String(value);
}

function buildDefaultPackageName(timestamp = Date.now()) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = formatDatePart(date.getMonth() + 1);
  const day = formatDatePart(date.getDate());
  const hour = formatDatePart(date.getHours());
  const minute = formatDatePart(date.getMinutes());
  const second = formatDatePart(date.getSeconds());
  return `SnaptiumBakcup-${year}${month}${day}-${hour}${minute}${second}${DEFAULT_EXTENSION}`;
}

function normalizeSavePath(filePath: string): string {
  const normalizedPath = String(filePath ?? '').trim();
  if (!normalizedPath) {
    return '';
  }

  const extension = path.extname(normalizedPath).toLowerCase();
  if (PACKAGE_EXTENSIONS.has(extension)) {
    return normalizedPath;
  }

  return `${normalizedPath}${DEFAULT_EXTENSION}`;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export const sppxExportService = {
  async exportPackage(): Promise<SppxExportResult> {
    const workspaceRoot = await vfsService.ensureInitialized().catch(() => null);
    if (!workspaceRoot) {
      throw new Error($t('dataTransfer.error.workspaceUnavailable'));
    }

    const databasePath = path.join(workspaceRoot, VFS_CONSTANTS.DATABASE_FOLDER);
    const databaseStat = await fs.stat(databasePath).catch(() => null);

    if (!databaseStat?.isDirectory()) {
      throw new Error($t('dataTransfer.error.databaseNotFound'));
    }

    const defaultPath = path.join(app.getPath('desktop'), buildDefaultPackageName());
    const focusedWindow = getFocusedWindow();
    const saveDialogOptions = {
      title: $t('dataTransfer.sppxExport.dialogTitle'),
      defaultPath,
      filters: [
        { name: 'Snaptium Portable Package Exchange', extensions: ['sppx', 'nwp'] },
      ],
    };
    const dialogResult = focusedWindow
      ? await dialog.showSaveDialog(focusedWindow, saveDialogOptions)
      : await dialog.showSaveDialog(saveDialogOptions);

    if (dialogResult.canceled || !dialogResult.filePath) {
      return {
        success: false,
        cancelled: true,
      };
    }

    const targetPackagePath = normalizeSavePath(dialogResult.filePath);
    try {
      await createZipArchiveFromDirectory({
        sourceDirectoryPath: databasePath,
        targetArchivePath: targetPackagePath,
        rootDirectoryName: VFS_CONSTANTS.DATABASE_FOLDER,
      });
    } catch (error) {
      if (await pathExists(targetPackagePath)) {
        await fs.unlink(targetPackagePath).catch(() => undefined);
      }
      logger.error(`Failed to export package: ${getErrorMessage(error)}`);
      throw error;
    }

    return {
      success: true,
      cancelled: false,
      filePath: targetPackagePath,
      exportedAt: Date.now(),
    };
  },
};
