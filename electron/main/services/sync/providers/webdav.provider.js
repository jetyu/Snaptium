import path from 'node:path';
import { createClient } from 'webdav';

function normalizeEndpoint(url) {
  return String(url ?? '').trim().replace(/\/+$/g, '');
}

function trimRemoteSegment(value) {
  return String(value ?? '').trim().replace(/^\/+|\/+$/g, '');
}

function joinRemotePath(...parts) {
  const normalized = parts
    .map((part) => trimRemoteSegment(part))
    .filter(Boolean);

  return normalized.length > 0 ? path.posix.join('/', ...normalized) : '/';
}

function isNotFoundError(error) {
  return error?.status === 404 || error?.response?.status === 404;
}

function normalizeDirectoryContents(contents) {
  if (Array.isArray(contents)) {
    return contents;
  }
  return contents ? [contents] : [];
}

export function createWebDavProvider(config) {
  const basePath = joinRemotePath(config.remotePath);
  const client = createClient(normalizeEndpoint(config.url), {
    username: String(config.username ?? ''),
    password: String(config.password ?? ''),
  });

  async function ensureRemoteDirectory(relativePath = '') {
    const targetPath = joinRemotePath(basePath, relativePath);
    await client.createDirectory(targetPath, { recursive: true }).catch((error) => {
      if (error?.status === 405 || error?.status === 409) {
        return;
      }
      throw error;
    });
  }

  return {
    async testConnection() {
      await ensureRemoteDirectory();
      await client.getDirectoryContents(basePath).catch((error) => {
        if (!isNotFoundError(error)) {
          throw error;
        }
      });
    },

    async listFiles(relativeDirectory = '') {
      const directoryPath = joinRemotePath(basePath, relativeDirectory);
      const contents = await client.getDirectoryContents(directoryPath, { deep: true }).catch((error) => {
        if (isNotFoundError(error)) {
          return [];
        }
        throw error;
      });

      const directoryRoot = relativeDirectory ? joinRemotePath(basePath, relativeDirectory) : basePath;

      return normalizeDirectoryContents(contents)
        .filter((entry) => entry?.type === 'file')
        .map((entry) => ({
          path: path.posix.relative(basePath, entry.filename),
          size: Number(entry.size ?? 0),
          modifiedAt: Date.parse(entry.lastmod ?? '') || Date.now(),
          absolutePath: entry.filename,
          directoryRoot,
        }));
    },

    async readText(relativePath) {
      const targetPath = joinRemotePath(basePath, relativePath);
      try {
        return await client.getFileContents(targetPath, { format: 'text' });
      } catch (error) {
        if (isNotFoundError(error)) {
          return null;
        }
        throw error;
      }
    },

    async writeText(relativePath, content) {
      const targetPath = joinRemotePath(basePath, relativePath);
      const parentDirectory = path.posix.dirname(path.posix.relative(basePath, targetPath));
      if (parentDirectory && parentDirectory !== '.') {
        await ensureRemoteDirectory(parentDirectory);
      } else {
        await ensureRemoteDirectory();
      }
      await client.putFileContents(targetPath, content, { overwrite: true });
    },

    async deleteFile(relativePath) {
      const targetPath = joinRemotePath(basePath, relativePath);
      try {
        await client.deleteFile(targetPath);
      } catch (error) {
        if (!isNotFoundError(error)) {
          throw error;
        }
      }
    },
  };
}