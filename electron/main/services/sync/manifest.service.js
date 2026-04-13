import crypto from 'node:crypto';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { VFS_CONSTANTS } from '../../constants/vfs.constants.js';

const EXCLUDED_DIRECTORIES = new Set([VFS_CONSTANTS.HISTORY_FOLDER]);

function databaseRoot(workspaceRoot) {
  return path.join(workspaceRoot, VFS_CONSTANTS.DATABASE_FOLDER);
}

function toPosixRelative(basePath, filePath) {
  return path.relative(basePath, filePath).split(path.sep).join('/');
}

function toLocalFilePath(workspaceRoot, relativePath) {
  return path.join(databaseRoot(workspaceRoot), ...relativePath.split('/'));
}

async function walkDatabaseFiles(targetDir) {
  const entries = await fs.readdir(targetDir, { withFileTypes: true }).catch((error) => {
    if (error && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  });

  const files = [];
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

export function hashContent(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

export function createManifestEntry(relativePath, content, modifiedAt = Date.now()) {
  return {
    path: relativePath,
    sha256: hashContent(content),
    size: Buffer.byteLength(content, 'utf8'),
    modifiedAt: Math.trunc(modifiedAt),
  };
}

export function createManifestFromEntries(entries, generatedAt = Date.now()) {
  const files = Object.create(null);
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

export function createEmptyManifest() {
  return createManifestFromEntries([]);
}

export function isManifestEmpty(manifest) {
  return Object.keys(manifest?.files ?? {}).length === 0;
}

export function parseRemoteManifest(text) {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.files !== 'object' || parsed.files === null) {
      return null;
    }

    const entries = Object.entries(parsed.files).map(([filePath, value]) => {
      const entry = value ?? {};
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

export function diffManifest(baseManifest, nextManifest) {
  const changes = new Map();
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

export async function scanLocalDatabase(workspaceRoot) {
  const basePath = databaseRoot(workspaceRoot);
  const filePaths = await walkDatabaseFiles(basePath);
  const entries = [];

  for (const filePath of filePaths) {
    const [content, stats] = await Promise.all([
      fs.readFile(filePath, 'utf8'),
      fs.stat(filePath),
    ]);

    entries.push(createManifestEntry(toPosixRelative(basePath, filePath), content, stats.mtimeMs));
  }

  return createManifestFromEntries(entries);
}

export async function readLocalFile(workspaceRoot, relativePath) {
  return await fs.readFile(toLocalFilePath(workspaceRoot, relativePath), 'utf8');
}

export async function writeLocalFile(workspaceRoot, relativePath, content) {
  const filePath = toLocalFilePath(workspaceRoot, relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
}

export async function deleteLocalFile(workspaceRoot, relativePath) {
  const filePath = toLocalFilePath(workspaceRoot, relativePath);
  await fs.unlink(filePath).catch((error) => {
    if (error && error.code === 'ENOENT') {
      return;
    }
    throw error;
  });
}