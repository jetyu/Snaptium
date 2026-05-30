import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import { BrowserWindow, dialog, type OpenDialogOptions } from 'electron';
import { $t } from '../../utils/i18n.js';
import { VFS_CONSTANTS } from '../../constants/vfs.constants.js';
import { loggerService } from '../logger.service.js';
import { vfsService } from '../vfs.service.js';
import { extractZipArchiveToDirectory } from './zip.utils.js';
import { getErrorMessage } from '../../services/error.service.js';

const logger = loggerService.createLogger('Main:NWP Import Service');

interface NwpImportResult {
  success: boolean;
  cancelled: boolean;
  stats?: {
    imported: number;
    skipped: number;
    failed: number;
  };
}

interface WorkspaceNode {
  id: string;
  type: string;
  name: string;
  parentId: string | null;
  order: number;
  createdAt: number;
  updatedAt: number;
  trashed: boolean;
  locked: boolean;
  contentId?: string;
  tags?: string[];
  [key: string]: unknown;
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

function buildTempDirectoryPath() {
  return path.join(os.tmpdir(), `notewizard-nwp-import-${Date.now()}-${crypto.randomUUID()}`);
}

async function findNodesFile(dirPath: string): Promise<string | null> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    // Look for nodes.jsonl in current directory
    const nodesEntry = entries.find((e) => e.isFile() && e.name === VFS_CONSTANTS.NODES_FILE);
    if (nodesEntry) {
      return path.join(dirPath, VFS_CONSTANTS.NODES_FILE);
    }

    // Search subdirectories
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const result = await findNodesFile(path.join(dirPath, entry.name));
        if (result) return result;
      }
    }
  } catch (err) {
    logger.error(`Error searching nodes file at ${dirPath}: ${getErrorMessage(err)}`);
  }

  return null;
}

async function moveDirectoryWithCrossDeviceFallback(
  sourcePath: string,
  targetPath: string,
): Promise<void> {
  try {
    await fs.rename(sourcePath, targetPath);
    return;
  } catch (error) {
    if (getErrorMessage(error).includes('EXDEV')) {
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
  const backupDatabasePath = path.join(
    workspaceRoot,
    `${VFS_CONSTANTS.DATABASE_FOLDER}.import-backup-${Date.now()}-${crypto.randomUUID()}`
  );

  let backupCreated = false;
  try {
    if (await pathExists(targetDatabasePath)) {
      await fs.rename(targetDatabasePath, backupDatabasePath);
      backupCreated = true;
    }
    await moveDirectoryWithCrossDeviceFallback(importedDatabasePath, targetDatabasePath);
  } catch (error) {
    if (backupCreated && (await pathExists(backupDatabasePath))) {
      if (await pathExists(targetDatabasePath)) {
        await fs.rm(targetDatabasePath, { recursive: true, force: true });
      }
      await fs.rename(backupDatabasePath, targetDatabasePath);
    }
    throw error;
  }

  if (backupCreated && (await pathExists(backupDatabasePath))) {
    await fs.rm(backupDatabasePath, { recursive: true, force: true }).catch(() => undefined);
  }
}

export const nwpImportService = {
  async importPackage(): Promise<NwpImportResult> {
    const workspaceRoot = await vfsService.ensureInitialized().catch(() => null);
    if (!workspaceRoot) {
      throw new Error($t('dataTransfer.error.workspaceUnavailable'));
    }

    const focusedWindow = getFocusedWindow();
    const openDialogOptions: OpenDialogOptions = {
      title: $t('dataTransfer.nwpImport.dialogTitle'),
      properties: ['openFile'],
      filters: [{ name: 'Legacy NWP Package', extensions: ['nwp'] }],
    };
    const openDialogResult = focusedWindow
      ? await dialog.showOpenDialog(focusedWindow, openDialogOptions)
      : await dialog.showOpenDialog(openDialogOptions);

    if (openDialogResult.canceled || openDialogResult.filePaths.length === 0) {
      return { success: false, cancelled: true };
    }

    const packagePath = openDialogResult.filePaths[0];
    const tempDirectoryPath = buildTempDirectoryPath();

    try {
      await fs.mkdir(tempDirectoryPath, { recursive: true });
      await extractZipArchiveToDirectory({
        archivePath: packagePath,
        targetDirectoryPath: tempDirectoryPath,
      });

      const extractedNodesFile = await findNodesFile(tempDirectoryPath);
      if (!extractedNodesFile) {
        logger.error(`Invalid NWP package: nodes.jsonl not found in ${tempDirectoryPath}`);
        throw new Error(`${$t('dataTransfer.error.invalidNwpPackage')} (Checked: ${tempDirectoryPath})`);
      }

      const extractedDbPath = path.dirname(extractedNodesFile);

      // Perform atomic database replacement
      await replaceDatabaseAtomically(workspaceRoot, extractedDbPath);

      // Reload VFS state
      await vfsService.reloadWorkspaceState(workspaceRoot);

      return { success: true, cancelled: false, stats: { imported: 1, skipped: 0, failed: 0 } };
    } finally {
      await fs.rm(tempDirectoryPath, { recursive: true, force: true }).catch(() => undefined);
    }
  },
};
