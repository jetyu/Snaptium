import crypto from 'node:crypto';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { VFS_CONSTANTS } from '../../constants/vfs.constants.js';

const EXCLUDED_DIRECTORIES: ReadonlySet<string> = new Set<string>([VFS_CONSTANTS.HISTORY_FOLDER]);

export interface ManifestEntry {
  path: string;
  sha256: string;
  size: number;
  modifiedAt: number;
}

export interface SyncManifest {
  version: number;
  generatedAt: number;
  files: Record<string, ManifestEntry>;
}

export type ManifestChangeType = 'added' | 'deleted' | 'modified';

export interface ManifestChange {
  type: ManifestChangeType;
  entry: ManifestEntry | null;
}

function databaseRoot(workspaceRoot: string): string {
  return path.join(workspaceRoot, VFS_CONSTANTS.DATABASE_FOLDER);
}

function toPosixRelative(basePath: string, filePath: string): string {
  return path.relative(basePath, filePath).split(path.sep).join('/');
}

function toLocalFilePath(workspaceRoot: string, relativePath: string): string {
  return path.join(databaseRoot(workspaceRoot), ...relativePath.split('/'));
}

async function walkDatabaseFiles(targetDir: string): Promise<string[]> {
  const entries = await fs.readdir(targetDir, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
    if (error && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  });

  const files: string[] = [];
  for (const entry of entries) {
    const nextPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRECTORIES.has(entry.name)) {
        continue;
      }
      files.push(...await walkDatabaseFiles(nextPath));
      continue;
    }
    files.push(nextPath);
  }

  return files;
}

export function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

export function createManifestEntry(relativePath: string, content: string, modifiedAt = Date.now()): ManifestEntry {
  return {
    path: relativePath,
    sha256: hashContent(content),
    size: Buffer.byteLength(content, 'utf8'),
    modifiedAt: Math.trunc(modifiedAt),
  };
}

export function createManifestFromEntries(entries: ManifestEntry[], generatedAt = Date.now()): SyncManifest {
  const files: Record<string, ManifestEntry> = Object.create(null) as Record<string, ManifestEntry>;
  for (const entry of entries) {
    if (!entry?.path) {
      continue;
    }
    files[entry.path] = {
      path: entry.path,
      sha256: String(entry.sha256 ?? ''),
      size: Number(entry.size ?? 0),
      modifiedAt: Number(entry.modifiedAt ?? generatedAt),
    };
  }

  return {
    version: 1,
    generatedAt,
    files,
  };
}

export function createEmptyManifest(): SyncManifest {
  return createManifestFromEntries([]);
}

export function isManifestEmpty(manifest: SyncManifest): boolean {
  return Object.keys(manifest?.files ?? {}).length === 0;
}

export function parseRemoteManifest(text: string): SyncManifest | null {
  try {
    const parsed = JSON.parse(text) as { files?: Record<string, unknown>; generatedAt?: number };
    if (!parsed || typeof parsed !== 'object' || typeof parsed.files !== 'object' || parsed.files === null) {
      return null;
    }

    const entries = Object.entries(parsed.files).map(([filePath, value]) => {
      const entry = typeof value === 'object' && value !== null
        ? value as Record<string, unknown>
        : {};
      return {
        path: filePath,
        sha256: String(entry.sha256 ?? ''),
        size: Number(entry.size ?? 0),
        modifiedAt: Number(entry.modifiedAt ?? parsed.generatedAt ?? Date.now()),
      };
    });

    return createManifestFromEntries(entries, Number(parsed.generatedAt ?? Date.now()));
  } catch {
    return null;
  }
}

export function diffManifest(baseManifest: SyncManifest, nextManifest: SyncManifest): Map<string, ManifestChange> {
  const changes = new Map<string, ManifestChange>();
  const baseFiles = baseManifest?.files ?? {};
  const nextFiles = nextManifest?.files ?? {};
  const paths = new Set([...Object.keys(baseFiles), ...Object.keys(nextFiles)]);

  for (const filePath of paths) {
    const baseEntry = baseFiles[filePath] ?? null;
    const nextEntry = nextFiles[filePath] ?? null;

    if (!baseEntry && nextEntry) {
      changes.set(filePath, { type: 'added', entry: nextEntry });
      continue;
    }

    if (baseEntry && !nextEntry) {
      changes.set(filePath, { type: 'deleted', entry: null });
      continue;
    }

    if (baseEntry && nextEntry && baseEntry.sha256 !== nextEntry.sha256) {
      changes.set(filePath, { type: 'modified', entry: nextEntry });
    }
  }

  return changes;
}

export async function scanLocalDatabase(workspaceRoot: string): Promise<SyncManifest> {
  const basePath = databaseRoot(workspaceRoot);
  const filePaths = await walkDatabaseFiles(basePath);
  const entries: ManifestEntry[] = [];

  for (const filePath of filePaths) {
    const [content, stats] = await Promise.all([
      fs.readFile(filePath, 'utf8'),
      fs.stat(filePath),
    ]);

    entries.push(createManifestEntry(toPosixRelative(basePath, filePath), content, stats.mtimeMs));
  }

  return createManifestFromEntries(entries);
}

export async function readLocalFile(workspaceRoot: string, relativePath: string): Promise<string> {
  return await fs.readFile(toLocalFilePath(workspaceRoot, relativePath), 'utf8');
}

export async function writeLocalFile(workspaceRoot: string, relativePath: string, content: string): Promise<void> {
  const filePath = toLocalFilePath(workspaceRoot, relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
}

export async function deleteLocalFile(workspaceRoot: string, relativePath: string): Promise<void> {
  const filePath = toLocalFilePath(workspaceRoot, relativePath);
  await fs.unlink(filePath).catch((error: NodeJS.ErrnoException) => {
    if (error && error.code === 'ENOENT') {
      return;
    }
    throw error;
  });
}
