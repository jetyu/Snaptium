import fs from 'node:fs/promises';
import path from 'node:path';
import { VFS_CONSTANTS } from '../constants/vfs.constants.js';
import { loggerService } from './logger.service.js';
import { writeUtf8 } from './file.service.js';
import { formatSnapshotFilename, filenameToTimestamp } from '../utils/formatTools.js';

const historyLogger = loggerService.createLogger('Electron:History Service');

/**
 * Get the history directory for a specific content ID
 */
function getHistoryDir(root, contentId) {
  return path.join(root, VFS_CONSTANTS.DATABASE_FOLDER, VFS_CONSTANTS.HISTORY_FOLDER, contentId);
}

/**
 * Check if a path exists
 */
async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export const historyService = {
  /**
   * Save a new version if it's different from the latest one
   */
  async saveVersion(root, contentId, content, maxVersions) {
    if (maxVersions <= 0) return;

    const historyDir = getHistoryDir(root, contentId);
    await fs.mkdir(historyDir, { recursive: true });

    const versions = await this.getVersions(root, contentId);

    // Deduplication: Check if content is the same as the latest version
    if (versions.length > 0) {
      const latestVersion = versions[0];
      const latestContent = await fs.readFile(path.join(historyDir, `${latestVersion.filename}${VFS_CONSTANTS.MARKDOWN_FILE_EXT}`), 'utf-8');
      if (latestContent === content) {
        historyLogger.debug(`Skipping history version for ${contentId} (no change)`);
        return;
      }
    }

    const now = Date.now();
    const fileName = `${formatSnapshotFilename(new Date(now))}`;
    const filePath = path.join(historyDir, `${fileName}${VFS_CONSTANTS.MARKDOWN_FILE_EXT}`);

    await writeUtf8(filePath, content);
    historyLogger.debug(`Saved history version for ${contentId} at ${fileName}`);

    // Trim old versions
    await this.trimVersions(root, contentId, maxVersions);
  },

  /**
   * Get all versions for a content ID, sorted by timestamp descending
   */
  async getVersions(root, contentId) {
    const historyDir = getHistoryDir(root, contentId);
    if (!(await pathExists(historyDir))) return [];

    try {
      const files = await fs.readdir(historyDir);
      const versions = await Promise.all(
        files
          .filter(f => f.endsWith(VFS_CONSTANTS.MARKDOWN_FILE_EXT))
          .map(async f => {
            const timestamp = filenameToTimestamp(f);
            const stats = await fs.stat(path.join(historyDir, f));
            return {
              timestamp,
              filename: f.replace(VFS_CONSTANTS.MARKDOWN_FILE_EXT, ''),
              size: stats.size,
            };
          })
      );

      return versions
        .filter(v => !isNaN(v.timestamp))
        .sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      historyLogger.error(`Failed to list versions for ${contentId}: ${error.message}`);
      return [];
    }
  },

  /**
   * Get the content of a specific version
   */
  async getVersionContent(root, contentId, filename) {
    const filePath = path.join(getHistoryDir(root, contentId), `${filename}${VFS_CONSTANTS.MARKDOWN_FILE_EXT}`);
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      historyLogger.error(`Failed to read version ${filename} for ${contentId}: ${error.message}`);
      throw error;
    }
  },

  /**
   * Remove old versions exceeding the limit
   */
  async trimVersions(root, contentId, max) {
    if (max <= 0) return;

    const versions = await this.getVersions(root, contentId);
    if (versions.length <= max) return;

    const toDelete = versions.slice(max);
    const historyDir = getHistoryDir(root, contentId);

    for (const v of toDelete) {
      const filePath = path.join(historyDir, `${v.filename}${VFS_CONSTANTS.MARKDOWN_FILE_EXT}`);
      try {
        await fs.unlink(filePath);
      } catch (error) {
        historyLogger.warn(`Failed to delete old version ${v.filename} for ${contentId}: ${error.message}`);
      }
    }

    historyLogger.debug(`Trimmed ${toDelete.length} old versions for ${contentId}`);
  }
};
