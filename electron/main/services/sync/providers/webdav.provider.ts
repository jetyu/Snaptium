import path from 'node:path';
import { createClient } from 'webdav';

interface WebDavProviderConfig {
  remotePath: string;
  url: string;
  username: string;
  password: string;
}

interface WebDavDirectoryEntry {
  type?: string;
  filename: string;
  size?: number;
  lastmod?: string;
}

interface WebDavProviderFile {
  path: string;
  size: number;
  modifiedAt: number;
  absolutePath: string;
  directoryRoot: string;
}

function normalizeEndpoint(url: unknown): string {
  return String(url ?? '').trim().replace(/\/+$/g, '');
}

function trimRemoteSegment(value: unknown): string {
  return String(value ?? '').trim().replace(/^\/+|\/+$/g, '');
}

function joinRemotePath(...parts: string[]): string {
  const normalized = parts
    .map((part) => trimRemoteSegment(part))
    .filter(Boolean);

  return normalized.length > 0 ? path.posix.join('/', ...normalized) : '/';
}

function isNotFoundError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const errorRecord = error as {
    status?: number;
    response?: {
      status?: number;
    };
  };
  return errorRecord.status === 404 || errorRecord.response?.status === 404;
}

function normalizeDirectoryContents(contents: unknown): WebDavDirectoryEntry[] {
  if (Array.isArray(contents)) {
    return contents as WebDavDirectoryEntry[];
  }
  if (!contents || typeof contents !== 'object') {
    return [];
  }
  return [contents as WebDavDirectoryEntry];
}

export function createWebDavProvider(config: WebDavProviderConfig): {
  testConnection(): Promise<void>;
  listFiles(relativeDirectory?: string): Promise<WebDavProviderFile[]>;
  readText(relativePath: string): Promise<string | null>;
  writeText(relativePath: string, content: string): Promise<void>;
  deleteFile(relativePath: string): Promise<void>;
} {
  const basePath = joinRemotePath(config.remotePath);
  const ensuredDirectories = new Set<string>();
  const pendingDirectoryEnsures = new Map<string, Promise<void>>();
  const client = createClient(normalizeEndpoint(config.url), {
    username: String(config.username ?? ''),
    password: String(config.password ?? ''),
  });

  async function ensureRemoteDirectory(relativePath = ''): Promise<void> {
    const targetPath = joinRemotePath(basePath, relativePath);
    if (ensuredDirectories.has(targetPath)) {
      return;
    }

    const pendingEnsure = pendingDirectoryEnsures.get(targetPath);
    if (pendingEnsure) {
      await pendingEnsure;
      return;
    }

    const ensurePromise = client.createDirectory(targetPath, { recursive: true })
      .catch((error: unknown) => {
        const errorRecord = error as { status?: number };
        if (errorRecord.status === 405 || errorRecord.status === 409) {
          return;
        }
        throw error;
      })
      .then(() => {
        ensuredDirectories.add(targetPath);
      })
      .finally(() => {
        pendingDirectoryEnsures.delete(targetPath);
      });

    pendingDirectoryEnsures.set(targetPath, ensurePromise);
    await ensurePromise;
  }

  return {
    async testConnection() {
      await ensureRemoteDirectory();
      await client.getDirectoryContents(basePath).catch((error: unknown) => {
        if (!isNotFoundError(error)) {
          throw error;
        }
      });
    },

    async listFiles(relativeDirectory = ''): Promise<WebDavProviderFile[]> {
      const directoryPath = joinRemotePath(basePath, relativeDirectory);
      const contents = await client.getDirectoryContents(directoryPath, { deep: true }).catch((error: unknown) => {
        if (isNotFoundError(error)) {
          return [] as WebDavDirectoryEntry[];
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

    async readText(relativePath: string): Promise<string | null> {
      const targetPath = joinRemotePath(basePath, relativePath);
      try {
        const content = await client.getFileContents(targetPath, { format: 'text' });
        return typeof content === 'string' ? content : String(content);
      } catch (error: unknown) {
        if (isNotFoundError(error)) {
          return null;
        }
        throw error;
      }
    },

    async writeText(relativePath: string, content: string): Promise<void> {
      const targetPath = joinRemotePath(basePath, relativePath);
      const parentDirectory = path.posix.dirname(path.posix.relative(basePath, targetPath));
      if (parentDirectory && parentDirectory !== '.') {
        await ensureRemoteDirectory(parentDirectory);
      } else {
        await ensureRemoteDirectory();
      }
      await client.putFileContents(targetPath, content, { overwrite: true });
    },

    async deleteFile(relativePath: string): Promise<void> {
      const targetPath = joinRemotePath(basePath, relativePath);
      try {
        await client.deleteFile(targetPath);
      } catch (error: unknown) {
        if (!isNotFoundError(error)) {
          throw error;
        }
      }
    },
  };
}
