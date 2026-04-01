import { app, shell } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { VFS_CONSTANTS } from '../constants/vfs.constants.js';
import { writeUtf8 } from './file.service.js';
import { loggerService } from './logger.service.js';

const LOG_SOURCE = 'VFS';


const workspaceState = {
  root: null,
  nodes: new Map(),
};


function databaseDir(root) {
  return path.join(root, VFS_CONSTANTS.DATABASE_FOLDER);
}

function objectsDir(root) {
  return path.join(databaseDir(root), VFS_CONSTANTS.OBJECTS_FOLDER);
}

function trashDir(root) {
  return path.join(databaseDir(root), VFS_CONSTANTS.TRASH_FOLDER);
}

function nodesFile(root) {
  return path.join(databaseDir(root), VFS_CONSTANTS.NODES_FILE);
}

function metaFile(root) {
  return path.join(databaseDir(root), VFS_CONSTANTS.META_FILE);
}

function preferencesFile() {
  return path.join(app.getPath(VFS_CONSTANTS.USER_DATA), VFS_CONSTANTS.PREFERENCES_FILE);
}

function getObjectFilePath(root, contentId) {
  const safeContentId = assertValidUUID(contentId, VFS_CONSTANTS.FIELD_CONTENT_ID);
  return path.join(objectsDir(root), `${safeContentId}${VFS_CONSTANTS.MARKDOWN_FILE_EXT}`);
}


export function assertNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${fieldName} must be a non-empty string`);
  }
  return value.trim();
}

function assertValidUUID(value, fieldName) {
  const trimmed = assertNonEmptyString(value, fieldName);
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(trimmed)) {
    throw new TypeError(`${fieldName} must be a valid UUID v4 format`);
  }
  return trimmed;
}

function normalizeNoteName(name) {
  const trimmedName = assertNonEmptyString(name, 'name');
  return trimmedName.endsWith(VFS_CONSTANTS.MARKDOWN_FILE_EXT) ? trimmedName.slice(0, -VFS_CONSTANTS.MARKDOWN_FILE_EXT.length) : trimmedName;
}

const writeQueues = new Map();

function enqueueWrite(key, fn) {
  const prev = writeQueues.get(key) ?? Promise.resolve();
  const next = prev.then(fn, () => fn());
  writeQueues.set(key, next.then(() => {}, () => {}));
  next.finally(() => {
    const current = writeQueues.get(key);
    if (!current || current === next) writeQueues.delete(key);
  });
  return next; 
}

const NODES_QUEUE_KEY = '__nodes__';

function isEnoentError(error) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT');
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function atomicWriteFile(targetPath, content) {
  const tempPath = `${targetPath}${VFS_CONSTANTS.TEMP_FILE_EXT}`;
  await writeUtf8(tempPath, content);
  try {
    await fs.rename(tempPath, targetPath);
  } catch (err) {
    // EXDEV: cross-device rename (shouldn't happen here but guard anyway)
    if (err && err.code === 'EXDEV') {
      await fs.copyFile(tempPath, targetPath);
      await fs.unlink(tempPath);
    } else {
      throw err;
    }
  }
}

function getWorkspaceRootByName(workspaceName) {
  return path.join(app.getPath(VFS_CONSTANTS.DOCUMENTS_FOLDER), workspaceName);
}

function normalizeWorkspaceRoot(rootPath) {
  const resolvedRoot = path.resolve(rootPath.trim());
  if (path.basename(resolvedRoot) === VFS_CONSTANTS.DATABASE_FOLDER) {
    return path.dirname(resolvedRoot);
  }
  return resolvedRoot;
}

function isSameWorkspaceRoot(left, right) {
  if (!left || !right) return false;
  const l = path.normalize(left);
  const r = path.normalize(right);
  return process.platform === 'win32' ? l.toLowerCase() === r.toLowerCase() : l === r;
}

async function getConfiguredWorkspaceRoot() {
  try {
    const rawPreferences = await fs.readFile(preferencesFile(), 'utf-8');
    const preferences = JSON.parse(rawPreferences);
    const noteSavePath = preferences?.[VFS_CONSTANTS.NOTE_SAVE_PATH_KEY];
    if (typeof noteSavePath === 'string' && noteSavePath.trim().length > 0) {
      const configuredRoot = normalizeWorkspaceRoot(noteSavePath);
      loggerService.info(LOG_SOURCE, `Using configured workspace root: ${configuredRoot}`);
      return configuredRoot;
    }
  } catch (error) {
    if (!isEnoentError(error)) {
      loggerService.warn(LOG_SOURCE, `Failed to read preferences workspace root: ${error}`);
    }
  }
  return null;
}

async function getDefaultWorkspaceRoot() {
  const configuredRoot = await getConfiguredWorkspaceRoot();
  return configuredRoot ?? getWorkspaceRootByName(VFS_CONSTANTS.CURRENT_WORKSPACE_NAME);
}

async function resolveWorkspaceRoot(rootPath) {
  if (typeof rootPath !== 'string' || rootPath.trim().length === 0) {
    return getDefaultWorkspaceRoot();
  }
  return normalizeWorkspaceRoot(rootPath);
}


function getNodeByContentId(contentId) {
  for (const node of workspaceState.nodes.values()) {
    if (node.contentId === contentId) return node;
  }
  return null;
}


async function ensureWorkspaceStructure(root) {
  await Promise.all([
    fs.mkdir(databaseDir(root), { recursive: true }),
    fs.mkdir(objectsDir(root), { recursive: true }),
    fs.mkdir(trashDir(root), { recursive: true }),
  ]);

  if (!(await pathExists(nodesFile(root)))) {
    await writeUtf8(nodesFile(root), '');
  }

  if (!(await pathExists(metaFile(root)))) {
    const now = Date.now();
    await writeUtf8(
      metaFile(root),
      JSON.stringify({ workspaceId: crypto.randomUUID(), version: 1, createdAt: now, lastOpenedAt: now }, null, 2),
    );
  }
}

async function loadAllNodes(root) {
  const filePath = nodesFile(root);
  const nodes = new Map();
  const content = await fs.readFile(filePath, 'utf-8');
  let malformedLineCount = 0;

  for (const line of content.split(/\r?\n/)) {
    if (!line) continue;
    try {
      const node = JSON.parse(line);
      if (node?.id) nodes.set(node.id, node);
    } catch {
      malformedLineCount += 1;
    }
  }

  if (malformedLineCount > 0) {
    loggerService.warn(LOG_SOURCE, `Ignored ${malformedLineCount} malformed node record(s) in ${filePath}`);
  }

  return nodes;
}

async function persistAllNodes(root) {
  const serialized = Array.from(workspaceState.nodes.values()).map((n) => JSON.stringify(n));
  const content = serialized.length > 0 ? `${serialized.join('\n')}\n` : '';
  return enqueueWrite(NODES_QUEUE_KEY, () => atomicWriteFile(nodesFile(root), content));
}


export const vfsService = {
  getAllNodes() {
    return Array.from(workspaceState.nodes.values());
  },

  async initializeWorkspace(rootPath) {
    const resolvedRoot = await resolveWorkspaceRoot(rootPath);
    await ensureWorkspaceStructure(resolvedRoot);

    workspaceState.root = resolvedRoot;
    workspaceState.nodes = await loadAllNodes(resolvedRoot);

    const metaPath = metaFile(resolvedRoot);
    try {
      const meta = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
      meta.lastOpenedAt = Date.now();
      await atomicWriteFile(metaPath, JSON.stringify(meta, null, 2));
    } catch (error) {
      loggerService.warn(LOG_SOURCE, `Failed to refresh workspace meta: ${error}`);
    }

    loggerService.info(LOG_SOURCE, `Workspace initialized at ${resolvedRoot} with ${workspaceState.nodes.size} node(s)`);
    return { root: resolvedRoot, nodes: Array.from(workspaceState.nodes.values()) };
  },

  async ensureInitialized(rootPath) {
    if (!workspaceState.root) {
      const { root } = await this.initializeWorkspace(rootPath);
      return root;
    }
    if (typeof rootPath === 'string' && rootPath.trim().length > 0) {
      const resolvedRoot = await resolveWorkspaceRoot(rootPath);
      if (!isSameWorkspaceRoot(workspaceState.root, resolvedRoot)) {
        loggerService.info(LOG_SOURCE, `Switching workspace root to ${resolvedRoot}`);
        const { root } = await this.initializeWorkspace(resolvedRoot);
        return root;
      }
    }
    return workspaceState.root;
  },

  async createFolder(parentId, name) {
    const root = await this.ensureInitialized();
    const displayName = assertNonEmptyString(name, 'name');
    const now = Date.now();
    const node = {
      id: crypto.randomUUID(),
      type: VFS_CONSTANTS.NODE_TYPE_FOLDER,
      name: displayName,
      parentId: typeof parentId === 'string' && parentId.trim().length > 0 ? parentId : null,
      order: now,
      createdAt: now,
      updatedAt: now,
      trashed: false,
      locked: false,
    };
    workspaceState.nodes.set(node.id, node);
    await persistAllNodes(root);
    loggerService.info(LOG_SOURCE, `Created notebook ${node.id}`);
    return node;
  },

  async createFile(parentId, name, content = '') {
    const root = await this.ensureInitialized();
    const displayName = normalizeNoteName(name);
    const contentId = crypto.randomUUID();
    const now = Date.now();
    const fileContent = typeof content === 'string' && content.length > 0 ? content : `# ${displayName}\n\n`;

    await atomicWriteFile(getObjectFilePath(root, contentId), fileContent);

    const node = {
      id: crypto.randomUUID(),
      type: VFS_CONSTANTS.NODE_TYPE_FILE,
      name: displayName,
      fileName: `${contentId}${VFS_CONSTANTS.MARKDOWN_FILE_EXT}`,
      parentId: typeof parentId === 'string' && parentId.trim().length > 0 ? parentId : null,
      order: now,
      createdAt: now,
      updatedAt: now,
      contentId,
      trashed: false,
      locked: false,
    };
    workspaceState.nodes.set(node.id, node);
    await persistAllNodes(root);
    loggerService.info(LOG_SOURCE, `Created note ${node.id}`);
    return node;
  },

  async renameNode(nodeId, name) {
    const root = await this.ensureInitialized();
    const safeNodeId = assertNonEmptyString(nodeId, VFS_CONSTANTS.FIELD_NODE_ID);
    const node = workspaceState.nodes.get(safeNodeId);
    if (!node || node.trashed) throw new Error(`Node not found: ${safeNodeId}`);

    const nextName = node.type === VFS_CONSTANTS.NODE_TYPE_FILE ? normalizeNoteName(name) : assertNonEmptyString(name, 'name');
    node.name = nextName;
    node.updatedAt = Date.now();
    workspaceState.nodes.set(node.id, node);
    await persistAllNodes(root);
    loggerService.info(LOG_SOURCE, `Renamed ${node.type} ${node.id} to ${nextName}`);
    return node;
  },

  async readContent(contentId) {
    const root = await this.ensureInitialized();
    try {
      return await fs.readFile(getObjectFilePath(root, contentId), 'utf-8');
    } catch (error) {
      if (isEnoentError(error)) {
        loggerService.warn(LOG_SOURCE, `Content file missing for ${contentId}`);
        return '';
      }
      loggerService.error(LOG_SOURCE, `Failed to read content ${contentId}: ${error}`);
      throw error;
    }
  },

  async writeContent(contentId, text) {
    const root = await this.ensureInitialized();
    if (typeof text !== 'string') throw new TypeError('content must be a string');
    const safeContentId = assertValidUUID(contentId, VFS_CONSTANTS.FIELD_CONTENT_ID);

    return enqueueWrite(safeContentId, async () => {
      const filePath = getObjectFilePath(root, safeContentId);
      await atomicWriteFile(filePath, text);
      const node = getNodeByContentId(safeContentId);
      if (node) {
        node.updatedAt = Date.now();
        await persistAllNodes(root);
      }
      return true;
    });
  },

  async showNoteInFolder(nodeId) {
    const root = await this.ensureInitialized();
    const safeNodeId = assertNonEmptyString(nodeId, VFS_CONSTANTS.FIELD_NODE_ID);
    const node = workspaceState.nodes.get(safeNodeId);
    if (!node || node.trashed) throw new Error(`Node not found: ${safeNodeId}`);
    if (node.type !== VFS_CONSTANTS.NODE_TYPE_FILE || !node.contentId) throw new Error(`Node is not a note: ${safeNodeId}`);

    const filePath = getObjectFilePath(root, node.contentId);
    if (!(await pathExists(filePath))) throw new Error(`Note file not found: ${filePath}`);

    shell.showItemInFolder(filePath);
    loggerService.info(LOG_SOURCE, `Revealed note ${safeNodeId} in folder.`);
    return true;
  },

  async deleteNode(nodeId) {
    const root = await this.ensureInitialized();
    const safeNodeId = assertNonEmptyString(nodeId, VFS_CONSTANTS.FIELD_NODE_ID);
    const node = workspaceState.nodes.get(safeNodeId);
    if (!node || node.trashed) throw new Error(`Node not found: ${safeNodeId}`);

    await deleteNodeRecursive(root, nodeId);
    await persistAllNodes(root);
    return node;
  },

  async toggleNodeLock(nodeId, locked) {
    const root = await this.ensureInitialized();
    const safeNodeId = assertNonEmptyString(nodeId, VFS_CONSTANTS.FIELD_NODE_ID);
    const node = workspaceState.nodes.get(safeNodeId);
    if (!node || node.trashed) throw new Error(`Node not found: ${safeNodeId}`);

    node.locked = Boolean(locked);
    node.updatedAt = Date.now();
    workspaceState.nodes.set(node.id, node);
    await persistAllNodes(root);
    loggerService.info(LOG_SOURCE, `${node.locked ? 'Locked' : 'Unlocked'} ${node.type} ${node.id}`);
    return node;
  },
};


async function deleteNodeRecursive(root, nodeId) {
  const safeNodeId = assertNonEmptyString(nodeId, VFS_CONSTANTS.FIELD_NODE_ID);
  const node = workspaceState.nodes.get(safeNodeId);
  if (!node || node.trashed) return;

  if (node.type === VFS_CONSTANTS.NODE_TYPE_FOLDER) {
    const children = Array.from(workspaceState.nodes.values()).filter(
      (n) => n.parentId === node.id && !n.trashed,
    );
    for (const child of children) {
      await deleteNodeRecursive(root, child.id);
    }
  }

  if (node.type === VFS_CONSTANTS.NODE_TYPE_FILE && node.contentId) {
    const source = getObjectFilePath(root, node.contentId);
    const destination = path.join(trashDir(root), `${node.contentId}${VFS_CONSTANTS.MARKDOWN_FILE_EXT}`);
    if (await pathExists(source)) await fs.rename(source, destination);
  }

  node.trashed = true;
  node.updatedAt = Date.now();
  workspaceState.nodes.set(node.id, node);
  loggerService.info(LOG_SOURCE, `Moved node ${safeNodeId} to trash.`);
}
