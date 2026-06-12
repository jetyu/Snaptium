import path from 'node:path';
import { promises as fs } from 'node:fs';
import { BrowserWindow, dialog, type OpenDialogOptions } from 'electron';
import { $t } from '../../utils/i18n.js';
import { VFS_CONSTANTS } from '../../constants/vfs.constants.js';
import { loggerService } from '../logger.service.js';
import { vfsService } from '../vfs.service.js';
import {
  isExternalResourcePath,
  isRelativeResourcePath,
  isSupportedMarkdownImagePath,
  makeUniqueFileName,
  makeUniqueName,
  replaceMarkdownImageDestinations,
  sanitizeFsName,
} from './markdown.utils.js';
import { getErrorMessage } from '../../services/error.service.js';

const logger = loggerService.createLogger('Main:Markdown Import Service');
const SYSTEM_DIRECTORY_NAMES = new Set<string>([
  '$RECYCLE.BIN',
  'System Volume Information',
  '__MACOSX',
]);

interface WorkspaceNode {
  id: string;
  type: string;
  name: string;
  parentId: string | null;
  contentId?: string;
  trashed?: boolean;
}

interface MarkdownImportStats {
  scannedFiles: number;
  importedNotes: number;
  createdNotebooks: number;
  copiedImages: number;
  skippedFiles: number;
  skippedImages: number;
  failedFiles: number;
  failedFilePaths: string[];
}

interface MarkdownImportResult {
  success: boolean;
  cancelled: boolean;
  directoryPath?: string;
  scannedFiles?: number;
  importedNotes?: number;
  createdNotebooks?: number;
  copiedImages?: number;
  skippedFiles?: number;
  skippedImages?: number;
  failedFiles?: number;
  failedFilePaths?: string[];
}

interface ImportRelativeImagesParams {
  markdownContent: string;
  sourceMarkdownPath: string;
  workspaceRoot: string;
  contentId: string;
  stats: MarkdownImportStats;
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

async function collectMarkdownFilesRecursively(rootDirectoryPath: string): Promise<string[]> {
  const result: string[] = [];

  async function walk(currentDirectoryPath: string): Promise<void> {
    const entries = await fs.readdir(currentDirectoryPath, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, 'en'));

    for (const entry of entries) {
      const absolutePath = path.join(currentDirectoryPath, entry.name);

      if (entry.isDirectory()) {
        if (entry.name.startsWith('.') || SYSTEM_DIRECTORY_NAMES.has(entry.name)) {
          continue;
        }
        await walk(absolutePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (path.extname(entry.name).toLowerCase() === '.md') {
        result.push(absolutePath);
      }
    }
  }

  await walk(rootDirectoryPath);
  return result;
}

async function readUtf8MarkdownFile(filePath: string): Promise<string> {
  const rawBuffer = await fs.readFile(filePath);
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let content = decoder.decode(rawBuffer);
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1);
  }
  return content;
}

function getTopLevelFolderNames(): Set<string> {
  return new Set<string>(
    (vfsService.getAllNodes() as WorkspaceNode[])
      .filter(
        (node) =>
          node.type === VFS_CONSTANTS.NODE_TYPE_FOLDER
          && !node.trashed
          && !node.parentId,
      )
      .map((node) => String(node.name ?? '').trim())
      .filter(Boolean),
  );
}

async function ensureFolderPath(
  parentFolderId: string,
  folderPathParts: string[],
  folderCache: Map<string, string>,
  stats: MarkdownImportStats,
): Promise<string> {
  let currentParentId = parentFolderId;
  for (const rawFolderName of folderPathParts) {
    if (!rawFolderName) {
      continue;
    }

    const normalizedFolderName = sanitizeFsName(rawFolderName, 'Notebook');
    const cacheKey = `${currentParentId}::${normalizedFolderName}`;

    if (!folderCache.has(cacheKey)) {
      const folderNode = await vfsService.createFolder(currentParentId, normalizedFolderName);
      folderCache.set(cacheKey, folderNode.id);
      stats.createdNotebooks += 1;
    }

    const nextParentId = folderCache.get(cacheKey);
    if (!nextParentId) {
      throw new Error(`Failed to resolve folder path for ${normalizedFolderName}`);
    }

    currentParentId = nextParentId;
  }

  return currentParentId;
}

async function importRelativeImagesToNote({
  markdownContent,
  sourceMarkdownPath,
  workspaceRoot,
  contentId,
  stats,
}: ImportRelativeImagesParams): Promise<string> {
  const imageTargets: string[] = [];
  replaceMarkdownImageDestinations(markdownContent, ({ destination }) => {
    imageTargets.push(destination);
    return destination;
  });

  if (imageTargets.length === 0) {
    return markdownContent;
  }

  const targetImageDirectory = path.join(
    workspaceRoot,
    VFS_CONSTANTS.DATABASE_FOLDER,
    VFS_CONSTANTS.IMAGES_FOLDER,
    contentId,
  );

  const copiedByAbsolutePath = new Map<string, string>();
  const rewrittenByOriginalDestination = new Map<string, string>();
  const usedImageNames = new Set<string>();

  for (const destination of imageTargets) {
    if (isExternalResourcePath(destination) || !isRelativeResourcePath(destination)) {
      continue;
    }

    if (!isSupportedMarkdownImagePath(destination)) {
      continue;
    }

    const absoluteSourcePath = path.resolve(path.dirname(sourceMarkdownPath), destination);
    if (!(await pathExists(absoluteSourcePath))) {
      stats.skippedImages += 1;
      continue;
    }

    const sourceStat = await fs.stat(absoluteSourcePath).catch(() => null);
    if (!sourceStat?.isFile()) {
      stats.skippedImages += 1;
      continue;
    }

    if (!copiedByAbsolutePath.has(absoluteSourcePath)) {
      await fs.mkdir(targetImageDirectory, { recursive: true });

      const extension = path.extname(absoluteSourcePath) || '.png';
      const baseName = sanitizeFsName(path.basename(absoluteSourcePath, extension), 'image');
      const targetImageFileName = makeUniqueFileName(baseName, extension, usedImageNames);
      const targetImagePath = path.join(targetImageDirectory, targetImageFileName);

      try {
        await fs.copyFile(absoluteSourcePath, targetImagePath);
        copiedByAbsolutePath.set(
          absoluteSourcePath,
          `../${VFS_CONSTANTS.IMAGES_FOLDER}/${contentId}/${targetImageFileName}`,
        );
        stats.copiedImages += 1;
      } catch (error) {
        logger.warn(`Failed to copy image during markdown import: ${getErrorMessage(error)}`);
        stats.skippedImages += 1;
        continue;
      }
    }

    const copiedPath = copiedByAbsolutePath.get(absoluteSourcePath);
    if (copiedPath) {
      rewrittenByOriginalDestination.set(destination, copiedPath);
    }
  }

  return replaceMarkdownImageDestinations(markdownContent, ({ destination }) => {
    return rewrittenByOriginalDestination.get(destination) ?? destination;
  });
}

export const markdownImportService = {
  async importMarkdown(): Promise<MarkdownImportResult> {
    const focusedWindow = getFocusedWindow();
    const openDialogOptions: OpenDialogOptions = {
      title: $t('dataTransfer.markdownImport.dialogTitle'),
      properties: ['openDirectory'],
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

    return await this.importDirectory(openDialogResult.filePaths[0]);
  },

  async importDirectory(sourceDirectoryPath: string): Promise<MarkdownImportResult> {
    const workspaceRoot = await vfsService.ensureInitialized().catch(() => null);
    if (!workspaceRoot) {
      throw new Error($t('dataTransfer.error.workspaceUnavailable'));
    }

    const markdownFiles = await collectMarkdownFilesRecursively(sourceDirectoryPath);
    const stats: MarkdownImportStats = {
      scannedFiles: markdownFiles.length,
      importedNotes: 0,
      createdNotebooks: 0,
      copiedImages: 0,
      skippedFiles: 0,
      skippedImages: 0,
      failedFiles: 0,
      failedFilePaths: [],
    };

    if (markdownFiles.length === 0) {
      return {
        success: true,
        cancelled: false,
        directoryPath: sourceDirectoryPath,
        ...stats,
      };
    }

    const existingTopLevelNames = getTopLevelFolderNames();
    const sourceRootName = sanitizeFsName(path.basename(sourceDirectoryPath), 'Imported Notes');
    const containerName = makeUniqueName(sourceRootName, existingTopLevelNames);
    const containerFolderNode = await vfsService.createFolder(null, containerName);
    stats.createdNotebooks += 1;

    const folderCache = new Map<string, string>();

    for (const markdownFilePath of markdownFiles) {
      try {
        const relativePath = path.relative(sourceDirectoryPath, markdownFilePath);
        const folderPart = path.dirname(relativePath);
        const folderSegments = folderPart === '.'
          ? []
          : folderPart.split(path.sep).filter(Boolean);

        const parentFolderId = await ensureFolderPath(
          containerFolderNode.id,
          folderSegments,
          folderCache,
          stats,
        );

        let markdownContent: string;
        try {
          markdownContent = await readUtf8MarkdownFile(markdownFilePath);
        } catch {
          stats.skippedFiles += 1;
          continue;
        }

        const noteTitle = sanitizeFsName(path.basename(markdownFilePath, '.md'), 'Untitled');
        const noteNode = await vfsService.createFile(parentFolderId, noteTitle, markdownContent);
        if (typeof noteNode.contentId !== 'string') {
          throw new Error(`Missing contentId for imported note "${noteTitle}"`);
        }

        const rewrittenMarkdownContent = await importRelativeImagesToNote({
          markdownContent,
          sourceMarkdownPath: markdownFilePath,
          workspaceRoot,
          contentId: noteNode.contentId,
          stats,
        });

        if (rewrittenMarkdownContent !== markdownContent) {
          await vfsService.writeContent(noteNode.contentId, rewrittenMarkdownContent);
        }

        stats.importedNotes += 1;
      } catch (error) {
        stats.failedFiles += 1;
        stats.failedFilePaths.push(markdownFilePath);
        logger.error(
          `Failed to import markdown file "${markdownFilePath}": ${getErrorMessage(error)}`,
        );
      }
    }

    return {
      success: true,
      cancelled: false,
      directoryPath: sourceDirectoryPath,
      ...stats,
    };
  },
};
