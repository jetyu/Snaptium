import fs from 'node:fs/promises';
import path from 'node:path';
import { VFS_CONSTANTS } from '../constants/vfs.constants.js';
import { loggerService } from './logger.service.js';
import { writeUtf8 } from './file.service.js';
import { formatSnapshotFilename, filenameToTimestamp } from '../utils/formatTools.js';
import { getErrorMessage } from '../utils/error.utils.js';

const historyLogger = loggerService.createLogger('Electron:History Service');

interface HistoryVersion {
  timestamp: number;
  filename: string;
  size: number;
}

function getHistoryDir(root: string, contentId: string): string {
  return path.join(root, VFS_CONSTANTS.DATABASE_FOLDER, VFS_CONSTANTS.HISTORY_FOLDER, contentId);
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export const historyService = {
  async saveVersion(
    root: string,
    contentId: string,
    content: string,
    maxVersions: number,
  ): Promise<void> {
    if (maxVersions <= 0) {
      return;
    }

    const historyDir = getHistoryDir(root, contentId);
    await fs.mkdir(historyDir, { recursive: true });

    const versions = await this.getVersions(root, contentId);

    if (versions.length > 0) {
      const latestVersion = versions[0];
      const latestContent = await fs.readFile(
        path.join(historyDir, `${latestVersion.filename}${VFS_CONSTANTS.MARKDOWN_FILE_EXT}`),
        'utf-8',
      );
      if (latestContent === content) {
        historyLogger.debug(`Skipping history version for ${contentId} (no change)`);
        return;
      }
    }

    const now = Date.now();
    const fileName = formatSnapshotFilename(new Date(now));
    const filePath = path.join(historyDir, `${fileName}${VFS_CONSTANTS.MARKDOWN_FILE_EXT}`);

    await writeUtf8(filePath, content);
    historyLogger.debug(`Saved history version for ${contentId} at ${fileName}`);

    await this.trimVersions(root, contentId, maxVersions);
  },

  async getVersions(root: string, contentId: string): Promise<HistoryVersion[]> {
    const historyDir = getHistoryDir(root, contentId);
    if (!(await pathExists(historyDir))) {
      return [];
    }

    try {
      const files = await fs.readdir(historyDir);
      const versions = await Promise.all(
        files
          .filter((fileName: string) => fileName.endsWith(VFS_CONSTANTS.MARKDOWN_FILE_EXT))
          .map(async (fileName: string): Promise<HistoryVersion> => {
            const timestamp = filenameToTimestamp(fileName);
            const stats = await fs.stat(path.join(historyDir, fileName));
            return {
              timestamp,
              filename: fileName.replace(VFS_CONSTANTS.MARKDOWN_FILE_EXT, ''),
              size: stats.size,
            };
          }),
      );

      return versions
        .filter((version) => !Number.isNaN(version.timestamp))
        .sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      historyLogger.error(`Failed to list versions for ${contentId}: ${getErrorMessage(error)}`);
      return [];
    }
  },

  async getVersionContent(root: string, contentId: string, filename: string): Promise<string> {
    const filePath = path.join(
      getHistoryDir(root, contentId),
      `${filename}${VFS_CONSTANTS.MARKDOWN_FILE_EXT}`,
    );

    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      historyLogger.error(
        `Failed to read version ${filename} for ${contentId}: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  },

  async trimVersions(root: string, contentId: string, max: number): Promise<void> {
    if (max <= 0) {
      return;
    }

    const versions = await this.getVersions(root, contentId);
    if (versions.length <= max) {
      return;
    }

    const toDelete = versions.slice(max);
    const historyDir = getHistoryDir(root, contentId);

    for (const version of toDelete) {
      const filePath = path.join(
        historyDir,
        `${version.filename}${VFS_CONSTANTS.MARKDOWN_FILE_EXT}`,
      );
      try {
        await fs.unlink(filePath);
      } catch (error) {
        historyLogger.warn(
          `Failed to delete old version ${version.filename} for ${contentId}: ${getErrorMessage(error)}`,
        );
      }
    }

    historyLogger.debug(`Trimmed ${toDelete.length} old versions for ${contentId}`);
  },
};
