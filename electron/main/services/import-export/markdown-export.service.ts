import path from 'node:path';
import { promises as fs } from 'node:fs';
import { BrowserWindow, dialog, type OpenDialogOptions } from 'electron';
import { $t } from '../../utils/i18n.js';
import { VFS_CONSTANTS } from '../../constants/vfs.constants.js';
import { loggerService } from '../logger.service.js';
import { vfsService } from '../vfs.service.js';
import {
  isExternalResourcePath,
  isPathInside,
  isRelativeResourcePath,
  makeUniqueFileName,
  makeUniqueName,
  normalizeToPosixPath,
  replaceMarkdownImageDestinations,
  sanitizeFsName,
} from './markdown.utils.js';
import { getErrorMessage } from '../../services/error.service.js';

const logger = loggerService.createLogger('Main:Markdown Export Service');

interface WorkspaceNode {
  id: string;
  type: string;
  name: string;
  parentId: string | null;
  contentId?: string;
  order?: number;
  createdAt?: number;
  trashed?: boolean;
}

interface MarkdownExportContext {
  exportedNotes: number;
  createdDirectories: number;
  copiedImages: number;
  skippedImages: number;
  failedFiles: number;
  failedFilePaths: string[];
  ensureDirectoryCache: Set<string>;
}

interface RewriteInternalImagesParams {
  markdownContent: string;
  workspaceRoot: string;
  markdownFilePath: string;
  assetsDirectoryPath: string;
  context: MarkdownExportContext;
}

interface MarkdownExportResult {
  success: boolean;
  cancelled: boolean;
  directoryPath?: string;
  exportedNotes?: number;
  createdDirectories?: number;
  copiedImages?: number;
  skippedImages?: number;
  failedFiles?: number;
  failedFilePaths?: string[];
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

async function ensureDirectory(
  targetPath: string,
  context: MarkdownExportContext,
): Promise<void> {
  if (context.ensureDirectoryCache.has(targetPath)) {
    return;
  }

  const exists = await pathExists(targetPath);
  if (!exists) {
    await fs.mkdir(targetPath, { recursive: true });
    context.createdDirectories += 1;
  }

  context.ensureDirectoryCache.add(targetPath);
}

function sortNodes(left: WorkspaceNode, right: WorkspaceNode): number {
  const leftOrder = Number(left.order ?? left.createdAt ?? 0);
  const rightOrder = Number(right.order ?? right.createdAt ?? 0);
  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  const leftCreatedAt = Number(left.createdAt ?? 0);
  const rightCreatedAt = Number(right.createdAt ?? 0);
  if (leftCreatedAt !== rightCreatedAt) {
    return leftCreatedAt - rightCreatedAt;
  }

  return String(left.id ?? '').localeCompare(String(right.id ?? ''), 'en');
}

async function rewriteInternalImagesForExport({
  markdownContent,
  workspaceRoot,
  markdownFilePath,
  assetsDirectoryPath,
  context,
}: RewriteInternalImagesParams): Promise<string> {
  const destinationList: string[] = [];
  replaceMarkdownImageDestinations(markdownContent, ({ destination }) => {
    destinationList.push(destination);
    return destination;
  });

  if (destinationList.length === 0) {
    return markdownContent;
  }

  const imagesRoot = path.join(
    workspaceRoot,
    VFS_CONSTANTS.DATABASE_FOLDER,
    VFS_CONSTANTS.IMAGES_FOLDER,
  );
  const noteSourceDirectory = path.join(
    workspaceRoot,
    VFS_CONSTANTS.DATABASE_FOLDER,
    VFS_CONSTANTS.OBJECTS_FOLDER,
  );

  const copiedByAbsolutePath = new Map<string, string>();
  const rewrittenByDestination = new Map<string, string>();
  const usedImageNames = new Set<string>();

  for (const destination of destinationList) {
    if (isExternalResourcePath(destination) || !isRelativeResourcePath(destination)) {
      continue;
    }

    const absoluteImagePath = path.resolve(noteSourceDirectory, destination);
    if (!isPathInside(imagesRoot, absoluteImagePath)) {
      context.skippedImages += 1;
      continue;
    }

    if (!(await pathExists(absoluteImagePath))) {
      context.skippedImages += 1;
      continue;
    }

    if (!copiedByAbsolutePath.has(absoluteImagePath)) {
      await ensureDirectory(assetsDirectoryPath, context);

      const extension = path.extname(absoluteImagePath) || '.png';
      const baseName = sanitizeFsName(path.basename(absoluteImagePath, extension), 'image');
      const imageFileName = makeUniqueFileName(baseName, extension, usedImageNames);
      const copiedImagePath = path.join(assetsDirectoryPath, imageFileName);

      try {
        await fs.copyFile(absoluteImagePath, copiedImagePath);
        context.copiedImages += 1;
        copiedByAbsolutePath.set(
          absoluteImagePath,
          normalizeToPosixPath(path.relative(path.dirname(markdownFilePath), copiedImagePath)),
        );
      } catch (error) {
        context.skippedImages += 1;
        logger.warn(`Failed to copy image during markdown export: ${getErrorMessage(error)}`);
        continue;
      }
    }

    const rewrittenPath = copiedByAbsolutePath.get(absoluteImagePath);
    if (rewrittenPath) {
      rewrittenByDestination.set(destination, rewrittenPath);
    }
  }

  return replaceMarkdownImageDestinations(markdownContent, ({ destination }) => {
    return rewrittenByDestination.get(destination) ?? destination;
  });
}

export const markdownExportService = {
  async exportMarkdown(): Promise<MarkdownExportResult> {
    const workspaceRoot = await vfsService.ensureInitialized().catch(() => null);
    if (!workspaceRoot) {
      throw new Error($t('dataTransfer.error.workspaceUnavailable'));
    }

    const focusedWindow = getFocusedWindow();
    const openDialogOptions: OpenDialogOptions = {
      title: $t('dataTransfer.markdownExport.dialogTitle'),
      properties: ['openDirectory', 'createDirectory'],
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

    const exportRootDirectory = openDialogResult.filePaths[0];
    await fs.mkdir(exportRootDirectory, { recursive: true });

    const allNodes = vfsService.getAllNodes().filter((node) => !node.trashed) as WorkspaceNode[];
    const folderNodes = allNodes
      .filter((node) => node.type === VFS_CONSTANTS.NODE_TYPE_FOLDER)
      .sort(sortNodes);
    const fileNodes = allNodes
      .filter(
        (node): node is WorkspaceNode & { contentId: string } =>
          node.type === VFS_CONSTANTS.NODE_TYPE_FILE && typeof node.contentId === 'string',
      )
      .sort(sortNodes);

    const folderPathById = new Map<string, string>();
    const usedFolderNamesByParentPath = new Map<string, Set<string>>();
    const usedFileNamesByDirectory = new Map<string, Set<string>>();

    const context: MarkdownExportContext = {
      exportedNotes: 0,
      createdDirectories: 0,
      copiedImages: 0,
      skippedImages: 0,
      failedFiles: 0,
      failedFilePaths: [],
      ensureDirectoryCache: new Set<string>([exportRootDirectory]),
    };

    for (const folderNode of folderNodes) {
      const parentPath = folderNode.parentId
        ? folderPathById.get(folderNode.parentId) ?? exportRootDirectory
        : exportRootDirectory;

      let usedFolderNames = usedFolderNamesByParentPath.get(parentPath);
      if (!usedFolderNames) {
        usedFolderNames = new Set<string>();
        usedFolderNamesByParentPath.set(parentPath, usedFolderNames);
      }

      const safeFolderName = sanitizeFsName(folderNode.name, 'Notebook');
      const exportFolderName = makeUniqueName(safeFolderName, usedFolderNames);
      const exportFolderPath = path.join(parentPath, exportFolderName);
      await ensureDirectory(exportFolderPath, context);
      folderPathById.set(folderNode.id, exportFolderPath);
    }

    for (const fileNode of fileNodes) {
      const parentPath = fileNode.parentId
        ? folderPathById.get(fileNode.parentId) ?? exportRootDirectory
        : exportRootDirectory;

      let usedFileNames = usedFileNamesByDirectory.get(parentPath);
      if (!usedFileNames) {
        usedFileNames = new Set<string>();
        usedFileNamesByDirectory.set(parentPath, usedFileNames);
      }

      const safeFileBase = sanitizeFsName(fileNode.name, 'Untitled');
      const markdownFileName = makeUniqueFileName(safeFileBase, '.md', usedFileNames);
      const markdownFilePath = path.join(parentPath, markdownFileName);
      const assetsDirectoryPath = path.join(
        parentPath,
        '_assets',
        path.basename(markdownFileName, '.md'),
      );

      try {
        const originalContent = await vfsService.readContent(fileNode.contentId);
        const rewrittenContent = await rewriteInternalImagesForExport({
          markdownContent: originalContent,
          workspaceRoot,
          markdownFilePath,
          assetsDirectoryPath,
          context,
        });

        await ensureDirectory(path.dirname(markdownFilePath), context);
        await fs.writeFile(markdownFilePath, rewrittenContent, 'utf8');
        context.exportedNotes += 1;
      } catch (error) {
        context.failedFiles += 1;
        context.failedFilePaths.push(normalizeToPosixPath(markdownFilePath));
        logger.error(`Failed to export note "${fileNode.name}": ${getErrorMessage(error)}`);
      }
    }

    return {
      success: true,
      cancelled: false,
      directoryPath: exportRootDirectory,
      exportedNotes: context.exportedNotes,
      createdDirectories: context.createdDirectories,
      copiedImages: context.copiedImages,
      skippedImages: context.skippedImages,
      failedFiles: context.failedFiles,
      failedFilePaths: context.failedFilePaths,
    };
  },
};
