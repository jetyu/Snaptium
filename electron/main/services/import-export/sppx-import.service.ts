import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import { BrowserWindow, dialog, type OpenDialogOptions } from 'electron';
import { $t } from '../../utils/i18n.js';
import { VFS_CONSTANTS } from '../../constants/vfs.constants.js';
import { loggerService } from '../logger.service.js';
import { vfsService } from '../vfs.service.js';
import { ragService } from '../rag.service.js';
import { syncStateService } from '../sync/state.service.js';
import { extractZipArchiveToDirectory } from './zip.utils.js';
import { getErrorCode, getErrorMessage } from '../../services/error.service.js';

const logger = loggerService.createLogger('Main:SPPX Import Service');

interface SppxImportResult {
  success: boolean;
  cancelled: boolean;
  filePath?: string;
  importedAt?: number;
}

function getFocusedWindow(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureDirectory(targetPath: string): Promise<void> {
  const targetStat = await fs.stat(targetPath);
  if (!targetStat.isDirectory()) {
    throw new Error(`Expected directory but got file: ${targetPath}`);
  }
}

function buildTempDirectoryPath() {
  return path.join(os.tmpdir(), `notewizard-sppx-import-${Date.now()}-${crypto.randomUUID()}`);
}

function buildDatabaseBackupPath(workspaceRoot: string): string {
  return path.join(
    workspaceRoot,
    `${VFS_CONSTANTS.DATABASE_FOLDER}.import-backup-${Date.now()}-${crypto.randomUUID()}`,
  );
}

async function moveDirectoryWithCrossDeviceFallback(
  sourcePath: string,
  targetPath: string,
): Promise<void> {
  try {
    await fs.rename(sourcePath, targetPath);
    return;
  } catch (error) {
    if (getErrorCode(error) === 'EXDEV') {
      await fs.cp(sourcePath, targetPath, {
        recursive: true,
        force: false,
        errorOnExist: true,
      });
      await fs.rm(sourcePath, { recursive: true, force: true });
      return;
    }

    throw error;
  }
}

async function replaceDatabaseAtomically(
  workspaceRoot: string,
  importedDatabasePath: string,
): Promise<void> {
  const targetDatabasePath = path.join(workspaceRoot, VFS_CONSTANTS.DATABASE_FOLDER);
  const backupDatabasePath = buildDatabaseBackupPath(workspaceRoot);

  let backupCreated = false;
  try {
    if (await pathExists(targetDatabasePath)) {
      await fs.rename(targetDatabasePath, backupDatabasePath);
      backupCreated = true;
    }

    await moveDirectoryWithCrossDeviceFallback(importedDatabasePath, targetDatabasePath);
  } catch (error) {
    if (backupCreated && await pathExists(backupDatabasePath)) {
      if (await pathExists(targetDatabasePath)) {
        await fs.rm(targetDatabasePath, { recursive: true, force: true }).catch((cleanupError) => {
          throw new Error(
            `Database import failed and cleanup failed: ${getErrorMessage(cleanupError)}`
          );
        });
      }

      await fs.rename(backupDatabasePath, targetDatabasePath).catch((rollbackError) => {
        throw new Error(
          `Database import failed and rollback failed: ${getErrorMessage(rollbackError)}`
        );
      });
    }

    throw error;
  }

  if (backupCreated && await pathExists(backupDatabasePath)) {
    await fs.rm(backupDatabasePath, { recursive: true, force: true }).catch((error) => {
      logger.warn(`Failed to remove database backup after import: ${getErrorMessage(error)}`);
    });
  }
}

async function resetWorkspaceSideEffects(workspaceRoot: string): Promise<void> {
  const lancedbPath = path.join(workspaceRoot, '.lancedb');

  await ragService.shutdown().catch((error) => {
    logger.warn(`Failed to shutdown RAG service before lancedb cleanup: ${getErrorMessage(error)}`);
  });

  await fs.rm(lancedbPath, { recursive: true, force: true }).catch((error) => {
    logger.warn(`Failed to clean up lancedb directory: ${getErrorMessage(error)}`);
  });

  await syncStateService.clearWorkspaceState(workspaceRoot).catch((error) => {
    logger.warn(`Failed to clear sync baseline after import: ${getErrorMessage(error)}`);
  });
}

export const sppxImportService = {
  async importPackage(): Promise<SppxImportResult> {
    const workspaceRoot = await vfsService.ensureInitialized().catch(() => null);
    if (!workspaceRoot) {
      throw new Error($t('dataTransfer.error.workspaceUnavailable'));
    }

    const focusedWindow = getFocusedWindow();
    const openDialogOptions: OpenDialogOptions = {
      title: $t('dataTransfer.sppxImport.dialogTitle'),
      properties: ['openFile'],
      filters: [
        { name: 'Snaptium Portable Package Exchange', extensions: ['sppx', 'nwp'] },
      ],
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

    const packagePath = openDialogResult.filePaths[0];
    const confirmDialogOptions = {
      type: 'warning' as const,
      buttons: [$t('button.cancel'), $t('dataTransfer.sppxImport.continueButton')],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
      title: $t('dataTransfer.sppxImport.confirmTitle'),
      message: $t('dataTransfer.sppxImport.confirmMessage'),
      detail: $t('dataTransfer.sppxImport.confirmDetail'),
    };
    const confirmDialogResult = focusedWindow
      ? await dialog.showMessageBox(focusedWindow, confirmDialogOptions)
      : await dialog.showMessageBox(confirmDialogOptions);

    if (confirmDialogResult.response !== 1) {
      return {
        success: false,
        cancelled: true,
      };
    }

    const tempDirectoryPath = buildTempDirectoryPath();
    try {
      await fs.mkdir(tempDirectoryPath, { recursive: true });
      await extractZipArchiveToDirectory({
        archivePath: packagePath,
        targetDirectoryPath: tempDirectoryPath,
      });

      const extractedDatabasePath = path.join(tempDirectoryPath, VFS_CONSTANTS.DATABASE_FOLDER);
      if (!await pathExists(extractedDatabasePath)) {
        throw new Error($t('dataTransfer.error.databaseNotFoundInPackage'));
      }
      await ensureDirectory(extractedDatabasePath);

      await replaceDatabaseAtomically(workspaceRoot, extractedDatabasePath);
      await resetWorkspaceSideEffects(workspaceRoot);
      await vfsService.reloadWorkspaceState(workspaceRoot).catch((error) => {
        logger.warn(`Failed to reload workspace cache after import: ${getErrorMessage(error)}`);
      });

      return {
        success: true,
        cancelled: false,
        filePath: packagePath,
        importedAt: Date.now(),
      };
    } finally {
      await fs.rm(tempDirectoryPath, { recursive: true, force: true }).catch(() => undefined);
    }
  },
};
