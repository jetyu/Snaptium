import { app, ipcMain, shell } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { IPC_CHANNELS } from '../constants/channels.constants.js';
import { VFS_CONSTANTS } from '../constants/vfs.js';
import { writeUtf8 } from '../services/file.service.js';
import { loggerService } from '../services/logger.service.js';

const VFS_LOG_SOURCE = 'VFS-IPC';

const workspaceState = {
  root: null,
  nodes: new Map(),
};

function getWorkspaceRootByName(workspaceName) {
  return path.join(app.getPath('documents'), workspaceName);
}

function preferencesFile() {
  return path.join(app.getPath('userData'), VFS_CONSTANTS.PREFERENCES_FILE);
}

function isEnoentError(error) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT');
}

function normalizeWorkspaceRoot(rootPath) {
  const resolvedRoot = path.resolve(rootPath.trim());

  if (path.basename(resolvedRoot) === VFS_CONSTANTS.DATABASE_FOLDER) {
    return path.dirname(resolvedRoot);
  }

  return resolvedRoot;
}

function isSameWorkspaceRoot(left, right) {
  if (!left || !right) {
    return false;
  }

  const normalizedLeft = path.normalize(left);
  const normalizedRight = path.normalize(right);

  return process.platform === 'win32'
    ? normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
    : normalizedLeft === normalizedRight;
}

async function getConfiguredWorkspaceRoot() {
  try {
    const rawPreferences = await fs.readFile(preferencesFile(), 'utf-8');
    const preferences = JSON.parse(rawPreferences);
    const noteSavePath = preferences?.[VFS_CONSTANTS.NOTE_SAVE_PATH_KEY];

    if (typeof noteSavePath === 'string' && noteSavePath.trim().length > 0) {
      const configuredRoot = normalizeWorkspaceRoot(noteSavePath);
      loggerService.info(VFS_LOG_SOURCE, `Using configured workspace root: ${configuredRoot}`);
      return configuredRoot;
    }
  } catch (error) {
    if (!isEnoentError(error)) {
      loggerService.warn(VFS_LOG_SOURCE, `Failed to read preferences workspace root: ${error}`);
    }
  }

  return null;
}

async function getDefaultWorkspaceRoot() {
  const configuredRoot = await getConfiguredWorkspaceRoot();
  if (configuredRoot) {
    return configuredRoot;
  }

  return getWorkspaceRootByName(VFS_CONSTANTS.CURRENT_WORKSPACE_NAME);
}

async function resolveWorkspaceRoot(rootPath) {
  if (typeof rootPath !== 'string' || rootPath.trim().length === 0) {
    return getDefaultWorkspaceRoot();
  }

  return normalizeWorkspaceRoot(rootPath);
}

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

function assertNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${fieldName} must be a non-empty string`);
  }

  return value.trim();
}

function normalizeNoteName(name) {
  const trimmedName = assertNonEmptyString(name, 'name');
  return trimmedName.endsWith('.md') ? trimmedName.slice(0, -3) : trimmedName;
}

function getObjectFilePath(root, contentId) {
  const safeContentId = assertNonEmptyString(contentId, 'contentId');
  return path.join(objectsDir(root), `${safeContentId}.md`);
}

function getNodeByContentId(contentId) {
  for (const node of workspaceState.nodes.values()) {
    if (node.contentId === contentId) {
      return node;
    }
  }

  return null;
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
  const tempPath = `${targetPath}.tmp`;
  await writeUtf8(tempPath, content);
  await fs.rename(tempPath, targetPath);
}

async function ensureWorkspaceStructure(root) {
  const dbPath = databaseDir(root);

  await Promise.all([
    fs.mkdir(dbPath, { recursive: true }),
    fs.mkdir(objectsDir(root), { recursive: true }),
    fs.mkdir(trashDir(root), { recursive: true }),
  ]);

  if (!(await pathExists(nodesFile(root)))) {
    await writeUtf8(nodesFile(root), '');
  }

  if (!(await pathExists(metaFile(root)))) {
    const now = Date.now();
    const meta = {
      workspaceId: crypto.randomUUID(),
      version: 1,
      createdAt: now,
      lastOpenedAt: now,
    };
    await writeUtf8(metaFile(root), JSON.stringify(meta, null, 2));
  }
}

async function loadAllNodes(root) {
  const filePath = nodesFile(root);
  const nodes = new Map();
  const content = await fs.readFile(filePath, 'utf-8');
  let malformedLineCount = 0;

  for (const line of content.split(/\r?\n/)) {
    if (!line) {
      continue;
    }

    try {
      const node = JSON.parse(line);
      if (node?.id) {
        nodes.set(node.id, node);
      }
    } catch {
      malformedLineCount += 1;
    }
  }

  if (malformedLineCount > 0) {
    loggerService.warn(VFS_LOG_SOURCE, `Ignored ${malformedLineCount} malformed node record(s) in ${filePath}`);
  }

  return nodes;
}

async function persistAllNodes(root) {
  const serializedNodes = Array.from(workspaceState.nodes.values()).map((node) => JSON.stringify(node));
  const fileContent = serializedNodes.length > 0 ? `${serializedNodes.join('\n')}\n` : '';
  await atomicWriteFile(nodesFile(root), fileContent);
}

async function initializeWorkspace(rootPath) {
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
    loggerService.warn(VFS_LOG_SOURCE, `Failed to refresh workspace meta for ${resolvedRoot}: ${error}`);
  }

  loggerService.info(
    VFS_LOG_SOURCE,
    `Workspace initialized at ${resolvedRoot} with ${workspaceState.nodes.size} node(s)`,
  );

  return {
    root: resolvedRoot,
    nodes: Array.from(workspaceState.nodes.values()),
  };
}

async function ensureWorkspaceInitialized(rootPath) {
  if (!workspaceState.root) {
    const { root } = await initializeWorkspace(rootPath);
    return root;
  }

  if (typeof rootPath === 'string' && rootPath.trim().length > 0) {
    const resolvedRoot = await resolveWorkspaceRoot(rootPath);
    if (!isSameWorkspaceRoot(workspaceState.root, resolvedRoot)) {
      loggerService.info(VFS_LOG_SOURCE, `Switching workspace root from ${workspaceState.root} to ${resolvedRoot}`);
      const { root } = await initializeWorkspace(resolvedRoot);
      return root;
    }
  }

  return workspaceState.root;
}

async function createFolder(parentId, name) {
  const root = await ensureWorkspaceInitialized();
  const displayName = assertNonEmptyString(name, 'name');
  const now = Date.now();

  const node = {
    id: crypto.randomUUID(),
    type: 'folder',
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
  loggerService.info(VFS_LOG_SOURCE, `Created notebook ${node.id} in workspace ${root}`);

  return node;
}

async function createFile(parentId, name, content = '') {
  const root = await ensureWorkspaceInitialized();
  const displayName = normalizeNoteName(name);
  const contentId = crypto.randomUUID();
  const now = Date.now();
  const fileContent = typeof content === 'string' && content.length > 0 ? content : `# ${displayName}\n\n`;

  await atomicWriteFile(getObjectFilePath(root, contentId), fileContent);

  const node = {
    id: crypto.randomUUID(),
    type: 'file',
    name: displayName,
    fileName: `${contentId}.md`,
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
  loggerService.info(VFS_LOG_SOURCE, `Created note ${node.id} in workspace ${root}`);

  return node;
}

async function renameNode(nodeId, name) {
  const root = await ensureWorkspaceInitialized();
  const safeNodeId = assertNonEmptyString(nodeId, 'nodeId');
  const node = workspaceState.nodes.get(safeNodeId);

  if (!node || node.trashed) {
    throw new Error(`Node not found: ${safeNodeId}`);
  }

  const nextName = node.type === 'file' ? normalizeNoteName(name) : assertNonEmptyString(name, 'name');
  node.name = nextName;
  node.updatedAt = Date.now();
  workspaceState.nodes.set(node.id, node);
  await persistAllNodes(root);
  loggerService.info(VFS_LOG_SOURCE, `Renamed ${node.type} ${node.id} to ${nextName}`);

  return node;
}

async function readContent(contentId) {
  const root = await ensureWorkspaceInitialized();

  try {
    return await fs.readFile(getObjectFilePath(root, contentId), 'utf-8');
  } catch (error) {
    if (isEnoentError(error)) {
      loggerService.warn(VFS_LOG_SOURCE, `Content file missing for ${contentId} in workspace ${root}`);
      return '';
    }

    loggerService.error(VFS_LOG_SOURCE, `Failed to read content ${contentId}: ${error}`);
    throw error;
  }
}

async function writeContent(contentId, text) {
  const root = await ensureWorkspaceInitialized();

  if (typeof text !== 'string') {
    throw new TypeError('content must be a string');
  }

  const safeContentId = assertNonEmptyString(contentId, 'contentId');
  const filePath = getObjectFilePath(root, safeContentId);
  const backupPath = `${filePath}.bak`;

  try {
    const original = await fs.readFile(filePath, 'utf-8');
    if (original.length > 0) {
      await writeUtf8(backupPath, original);
    }
  } catch (error) {
    if (!isEnoentError(error)) {
      loggerService.error(VFS_LOG_SOURCE, `Failed to create backup for ${safeContentId}: ${error}`);
      throw error;
    }
  }

  try {
    await atomicWriteFile(filePath, text);

    const node = getNodeByContentId(safeContentId);
    if (node) {
      node.updatedAt = Date.now();
      await persistAllNodes(root);
    }

    if (await pathExists(backupPath)) {
      await fs.unlink(backupPath);
    }

    return true;
  } catch (error) {
    loggerService.error(VFS_LOG_SOURCE, `Failed to write content ${safeContentId}: ${error}`);

    if (await pathExists(backupPath)) {
      try {
        await fs.copyFile(backupPath, filePath);
        await fs.unlink(backupPath);
      } catch (rollbackError) {
        loggerService.error(VFS_LOG_SOURCE, `Failed to rollback content ${safeContentId}: ${rollbackError}`);
      }
    }

    throw error;
  }
}

async function showNoteInFolder(nodeId) {
  const root = await ensureWorkspaceInitialized();
  const safeNodeId = assertNonEmptyString(nodeId, 'nodeId');
  const node = workspaceState.nodes.get(safeNodeId);

  if (!node || node.trashed) {
    throw new Error(`Node not found: ${safeNodeId}`);
  }

  if (node.type !== 'file' || !node.contentId) {
    throw new Error(`Node is not a note: ${safeNodeId}`);
  }

  const filePath = getObjectFilePath(root, node.contentId);

  if (!(await pathExists(filePath))) {
    throw new Error(`Note file not found: ${filePath}`);
  }

  shell.showItemInFolder(filePath);
  loggerService.info(VFS_LOG_SOURCE, `Revealed note ${safeNodeId} in folder.`);
  return true;
}

async function deleteNode(nodeId) {
  const root = await ensureWorkspaceInitialized();
  const safeNodeId = assertNonEmptyString(nodeId, 'nodeId');
  const node = workspaceState.nodes.get(safeNodeId);

  if (!node || node.trashed) {
    throw new Error(`Node not found: ${safeNodeId}`);
  }

  if (node.type === 'file' && node.contentId) {
    const source = getObjectFilePath(root, node.contentId);
    const destination = path.join(trashDir(root), `${node.contentId}.md`);

    if (await pathExists(source)) {
      await fs.rename(source, destination);
    }
  }

  node.trashed = true;
  node.updatedAt = Date.now();
  workspaceState.nodes.set(node.id, node);
  await persistAllNodes(root);
  loggerService.info(VFS_LOG_SOURCE, `Moved node ${safeNodeId} to trash.`);
  return node;
}

export function registerVfsIpcHandlers() {
  ipcMain.removeHandler(IPC_CHANNELS.VFS_INIT);
  ipcMain.removeHandler(IPC_CHANNELS.VFS_CREATE_FILE);
  ipcMain.removeHandler(IPC_CHANNELS.VFS_CREATE_FOLDER);
  ipcMain.removeHandler(IPC_CHANNELS.VFS_RENAME_NODE);
  ipcMain.removeHandler(IPC_CHANNELS.VFS_READ_CONTENT);
  ipcMain.removeHandler(IPC_CHANNELS.VFS_WRITE_CONTENT);
  ipcMain.removeHandler(IPC_CHANNELS.VFS_SHOW_NOTE_IN_FOLDER);
  ipcMain.removeHandler(IPC_CHANNELS.VFS_DELETE_NODE);

  ipcMain.handle(IPC_CHANNELS.VFS_INIT, async (_event, rootPath) => {
    return initializeWorkspace(rootPath);
  });

  ipcMain.handle(IPC_CHANNELS.VFS_CREATE_FILE, async (_event, payload = {}) => {
    return createFile(payload.parentId ?? null, payload.name, payload.content ?? '');
  });

  ipcMain.handle(IPC_CHANNELS.VFS_CREATE_FOLDER, async (_event, payload = {}) => {
    return createFolder(payload.parentId ?? null, payload.name);
  });

  ipcMain.handle(IPC_CHANNELS.VFS_RENAME_NODE, async (_event, payload = {}) => {
    return renameNode(payload.nodeId, payload.name);
  });

  ipcMain.handle(IPC_CHANNELS.VFS_READ_CONTENT, async (_event, contentId) => {
    return readContent(contentId);
  });

  ipcMain.handle(IPC_CHANNELS.VFS_WRITE_CONTENT, async (_event, payload = {}) => {
    return writeContent(payload.contentId, payload.content);
  });

  ipcMain.handle(IPC_CHANNELS.VFS_SHOW_NOTE_IN_FOLDER, async (_event, nodeId) => {
    return showNoteInFolder(nodeId);
  });

  ipcMain.handle(IPC_CHANNELS.VFS_DELETE_NODE, async (_event, nodeId) => {
    return deleteNode(nodeId);
  });
}

