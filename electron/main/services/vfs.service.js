import { app, shell, BrowserWindow, dialog } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { VFS_CONSTANTS } from '../constants/vfs.constants.js';
import { $t } from '../utils/i18n.js';
import { writeUtf8 } from './file.service.js';
import { loggerService } from './logger.service.js';
import { historyService } from './history.service.js';
import { settingsService } from './settings.service.js';

const logger = loggerService.createLogger('Electron:VFS Service');

const workspaceState = {
  root: null,
  nodes: new Map(),
};

const lastSnapshotTimes = new Map();

function databaseDir(root) {
  return path.join(root, VFS_CONSTANTS.DATABASE_FOLDER);
}

function objectsDir(root) {
  return path.join(databaseDir(root), VFS_CONSTANTS.OBJECTS_FOLDER);
}

function imagesDir(root) {
  return path.join(databaseDir(root), VFS_CONSTANTS.IMAGES_FOLDER);
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

function getContentImagesDir(root, contentId) {
  const safeContentId = assertValidUUID(contentId, VFS_CONSTANTS.FIELD_CONTENT_ID);
  return path.join(imagesDir(root), safeContentId);
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

function assertNonNegativeInteger(value, fieldName) {
  if (!Number.isInteger(value) || value < 0) {
    throw new TypeError(`${fieldName} must be a non-negative integer`);
  }

  return value;
}

const writeQueues = new Map();
const ORDER_STEP = 1024;

function enqueueWrite(key, fn) {
  const prev = writeQueues.get(key) ?? Promise.resolve();
  const next = prev.then(fn, () => fn());
  writeQueues.set(key, next.then(() => { }, () => { }));
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
    if (err && err.code === 'EXDEV') {
      await fs.copyFile(tempPath, targetPath);
      await fs.unlink(tempPath);
    } else {
      throw err;
    }
  }
}

async function atomicWriteBuffer(targetPath, content) {
  const tempPath = `${targetPath}${VFS_CONSTANTS.TEMP_FILE_EXT}`;
  await fs.writeFile(tempPath, content);
  try {
    await fs.rename(tempPath, targetPath);
  } catch (err) {
    if (err && err.code === 'EXDEV') {
      await fs.copyFile(tempPath, targetPath);
      await fs.unlink(tempPath);
    } else {
      throw err;
    }
  }
}

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg']);
const IMAGE_MIME_EXTENSIONS = Object.freeze({
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/bmp': '.bmp',
  'image/svg+xml': '.svg',
});

function sanitizeAssetBaseName(fileName) {
  const sanitizedCharacters = Array.from(String(fileName ?? '').trim(), (character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint < 32 || /[<>:"/\\|?*]/.test(character)) {
      return '-';
    }

    return character;
  }).join('');

  const normalized = sanitizedCharacters
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^\.+|\.+$/g, '')
    .replace(/^-+|-+$/g, '');

  return normalized || 'image';
}

function getImageExtension(fileName, mimeType) {
  const normalizedExtension = path.extname(String(fileName ?? '')).toLowerCase();
  if (IMAGE_EXTENSIONS.has(normalizedExtension)) {
    return normalizedExtension;
  }

  return IMAGE_MIME_EXTENSIONS[String(mimeType ?? '').toLowerCase()] ?? '.png';
}

function createImageFileName(fileName, mimeType) {
  const extension = getImageExtension(fileName, mimeType);
  const rawBaseName = fileName ? path.basename(fileName, path.extname(fileName)) : '';
  const baseName = sanitizeAssetBaseName(rawBaseName);
  return `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${baseName}${extension}`;
}

function getWorkspaceRootByName(workspaceName) {
  return path.join(app.getPath(VFS_CONSTANTS.DOCUMENTS_FOLDER), workspaceName);
}

function getFocusedWindow() {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;
}

function interpolateMessage(template, replacements = {}) {
  return Object.entries(replacements).reduce((message, [key, value]) => {
    return message.replaceAll(`{${key}}`, String(value));
  }, template);
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
      logger.debug(`Using configured workspace root: ${configuredRoot}`);
      return configuredRoot;
    }
  } catch (error) {
    if (!isEnoentError(error)) {
      logger.warn(`Failed to read preferences workspace root: ${error}`);
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

function compareNodeOrder(left, right) {
  const leftOrder = Number(left?.order ?? left?.createdAt ?? 0);
  const rightOrder = Number(right?.order ?? right?.createdAt ?? 0);

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  const leftCreatedAt = Number(left?.createdAt ?? 0);
  const rightCreatedAt = Number(right?.createdAt ?? 0);

  if (leftCreatedAt !== rightCreatedAt) {
    return leftCreatedAt - rightCreatedAt;
  }

  return String(left?.id ?? '').localeCompare(String(right?.id ?? ''));
}

function getActiveChildren(parentId, options = {}) {
  const excludeNodeId = options.excludeNodeId ?? null;

  return Array.from(workspaceState.nodes.values())
    .filter((node) => {
      if (node.trashed) {
        return false;
      }

      if ((node.parentId ?? null) !== (parentId ?? null)) {
        return false;
      }

      return node.id !== excludeNodeId;
    })
    .sort(compareNodeOrder);
}

function applySiblingOrder(nodes, updatedAt) {
  nodes.forEach((node, index) => {
    node.order = (index + 1) * ORDER_STEP;
    node.updatedAt = updatedAt;
    workspaceState.nodes.set(node.id, node);
  });
}

function isDescendantNode(candidateId, ancestorId) {
  let currentId = candidateId;

  while (currentId) {
    if (currentId === ancestorId) {
      return true;
    }

    const currentNode = workspaceState.nodes.get(currentId);
    currentId = currentNode?.parentId ?? null;
  }

  return false;
}

async function ensureWorkspaceStructure(root) {
  await Promise.all([
    fs.mkdir(databaseDir(root), { recursive: true }),
    fs.mkdir(objectsDir(root), { recursive: true }),
    fs.mkdir(imagesDir(root), { recursive: true }),
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
    logger.warn(`Ignored ${malformedLineCount} malformed node record(s) in ${filePath}`);
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

  getCurrentRoot() {
    return workspaceState.root;
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
      logger.error(`Failed to refresh workspace meta: ${error}`);
    }

    logger.debug(`Workspace initialized at ${resolvedRoot} with ${workspaceState.nodes.size} node(s)`);

    vfsService.autoClearTrash(resolvedRoot).catch(error => {
      logger.error(`Failed to auto clear trash: ${error.message}`);
    });

    return { root: resolvedRoot, nodes: Array.from(workspaceState.nodes.values()) };
  },

  async reloadWorkspaceState(rootPath) {
    const resolvedRoot = await resolveWorkspaceRoot(rootPath ?? workspaceState.root ?? undefined);
    await ensureWorkspaceStructure(resolvedRoot);
    workspaceState.root = resolvedRoot;
    workspaceState.nodes = await loadAllNodes(resolvedRoot);
    logger.debug(`Workspace cache reloaded at ${resolvedRoot} with ${workspaceState.nodes.size} node(s)`);
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
        logger.debug(`Switching workspace root to ${resolvedRoot}`);
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
    logger.debug(`Created Notebook ${node.id}`);
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
    logger.debug(`Created Note ${node.id}`);
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
    logger.debug(`Renamed ${node.type} ${node.id} to ${nextName}`);
    return node;
  },

  async moveNode(nodeId, parentId, index) {
    const root = await this.ensureInitialized();
    const safeNodeId = assertNonEmptyString(nodeId, VFS_CONSTANTS.FIELD_NODE_ID);
    const safeParentId = typeof parentId === 'string' && parentId.trim().length > 0
      ? assertValidUUID(parentId, 'parentId')
      : null;
    const safeIndex = assertNonNegativeInteger(index, 'index');
    const node = workspaceState.nodes.get(safeNodeId);

    if (!node || node.trashed) {
      throw new Error(`Node not found: ${safeNodeId}`);
    }

    if (safeParentId === safeNodeId) {
      throw new Error(`Cannot move node ${safeNodeId} into itself`);
    }

    if (safeParentId) {
      const parentNode = workspaceState.nodes.get(safeParentId);
      if (!parentNode || parentNode.trashed) {
        throw new Error(`Target parent not found: ${safeParentId}`);
      }

      if (parentNode.type !== VFS_CONSTANTS.NODE_TYPE_FOLDER) {
        throw new Error(`Target parent must be a notebook: ${safeParentId}`);
      }

      if (node.type === VFS_CONSTANTS.NODE_TYPE_FOLDER && isDescendantNode(safeParentId, safeNodeId)) {
        throw new Error(`Cannot move notebook ${safeNodeId} into its descendant ${safeParentId}`);
      }
    }

    const sourceParentId = node.parentId ?? null;
    const sameParent = sourceParentId === safeParentId;
    const sourceSiblings = getActiveChildren(sourceParentId, { excludeNodeId: safeNodeId });
    const targetSiblings = sameParent
      ? sourceSiblings
      : getActiveChildren(safeParentId, { excludeNodeId: safeNodeId });
    const boundedIndex = Math.min(safeIndex, targetSiblings.length);
    const currentIndex = sameParent
      ? getActiveChildren(sourceParentId).findIndex((sibling) => sibling.id === safeNodeId)
      : -1;

    if (sameParent && currentIndex === boundedIndex) {
      return node;
    }

    const updatedAt = Date.now();
    node.parentId = safeParentId;

    if (sameParent) {
      const nextSiblings = [...targetSiblings];
      nextSiblings.splice(boundedIndex, 0, node);
      applySiblingOrder(nextSiblings, updatedAt);
    } else {
      const nextTargetSiblings = [...targetSiblings];
      nextTargetSiblings.splice(boundedIndex, 0, node);
      applySiblingOrder(sourceSiblings, updatedAt);
      applySiblingOrder(nextTargetSiblings, updatedAt);
    }

    workspaceState.nodes.set(node.id, node);
    await persistAllNodes(root);
    logger.debug(`Moved ${node.type} ${node.id} to parent ${safeParentId ?? 'root'} at index ${boundedIndex}`);
    return node;
  },

  async readContent(contentId) {
    const root = await this.ensureInitialized();
    try {
      return await fs.readFile(getObjectFilePath(root, contentId), 'utf-8');
    } catch (error) {
      if (isEnoentError(error)) {
        logger.error(`Content file missing for ${contentId}`);
        return '';
      }
      logger.error(`Failed to read content ${contentId}: ${error}`);
      throw error;
    }
  },

  async writeContent(contentId, text) {
    const root = await this.ensureInitialized();
    if (typeof text !== 'string') throw new TypeError('content must be a string');
    const safeContentId = assertValidUUID(contentId, VFS_CONSTANTS.FIELD_CONTENT_ID);

    return enqueueWrite(safeContentId, async () => {
      const config = await settingsService.loadConfig();
      const interval = (config.snapshotInterval) * 60 * 1000;
      const lastTime = lastSnapshotTimes.get(safeContentId) || 0;

      if (config.maxHistoryVersions > 0) {
        try {
          const oldContent = await this.readContent(safeContentId);

          // 简化策略：时间间隔到达 且 笔记有一定内容（> 100 字符）
          const isTimeElapsed = (Date.now() - lastTime) >= interval;
          const isMeaningful = text.length > 100;

          if (isTimeElapsed && isMeaningful) {
            if (oldContent !== text) {
              await historyService.saveVersion(root, safeContentId, oldContent, config.maxHistoryVersions);
              lastSnapshotTimes.set(safeContentId, Date.now());
            }
          }
        } catch (error) {
          logger.warn(`Failed to save history version: ${error.message}`);
        }
      }

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

  async saveImage(contentId, payload) {
    const root = await this.ensureInitialized();
    const safeContentId = assertValidUUID(contentId, VFS_CONSTANTS.FIELD_CONTENT_ID);
    const mimeType = assertNonEmptyString(payload?.mimeType, 'mimeType').toLowerCase();
    if (!mimeType.startsWith('image/')) {
      throw new TypeError('mimeType must be an image type');
    }

    const node = getNodeByContentId(safeContentId);
    if (!node || node.trashed) {
      throw new Error(`Node not found for contentId: ${safeContentId}`);
    }

    const fileName = createImageFileName(payload?.fileName, mimeType);
    const imageDirectory = getContentImagesDir(root, safeContentId);
    await fs.mkdir(imageDirectory, { recursive: true });

    const filePath = path.join(imageDirectory, fileName);
    const buffer = Buffer.from(assertNonEmptyString(payload?.dataBase64, 'dataBase64'), 'base64');
    await atomicWriteBuffer(filePath, buffer);

    node.updatedAt = Date.now();
    workspaceState.nodes.set(node.id, node);
    await persistAllNodes(root);

    logger.debug(`Saved image for content ${safeContentId}: ${filePath}`);

    return {
      fileName,
      filePath,
      markdownPath: `../${VFS_CONSTANTS.IMAGES_FOLDER}/${safeContentId}/${fileName}`,
    };
  },

  async getHistory(contentId) {
    const root = await this.ensureInitialized();
    return await historyService.getVersions(root, contentId);
  },

  async getHistoryContent(contentId, timestamp) {
    const root = await this.ensureInitialized();
    return await historyService.getVersionContent(root, contentId, timestamp);
  },

  async recoverVersion(nodeId, timestamp) {
    const root = await this.ensureInitialized();
    const safeNodeId = assertNonEmptyString(nodeId, VFS_CONSTANTS.FIELD_NODE_ID);
    const node = workspaceState.nodes.get(safeNodeId);
    if (!node || !node.contentId) throw new Error(`Node not found or has no content: ${safeNodeId}`);

    const contentId = node.contentId;
    const historyContent = await historyService.getVersionContent(root, contentId, timestamp);

    return await this.writeContent(contentId, historyContent);
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
    logger.debug(`Revealed note ${safeNodeId} in folder.`);
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
    logger.debug(`${node.locked ? 'Locked' : 'Unlocked'} ${node.type} ${node.id}`);
    return node;
  },

  getTrashedNodes() {
    return Array.from(workspaceState.nodes.values())
      .filter((node) => node.trashed)
      .map((node) => {
        if (node.type === VFS_CONSTANTS.NODE_TYPE_FOLDER) {
          return {
            ...node,
            childCount: countDescendants(node.id),
          };
        }
        return node;
      });
  },

  async restoreNode(nodeId) {
    const root = await this.ensureInitialized();
    const safeNodeId = assertNonEmptyString(nodeId, VFS_CONSTANTS.FIELD_NODE_ID);
    const node = workspaceState.nodes.get(safeNodeId);
    if (!node || !node.trashed) throw new Error(`Node not found in trash: ${safeNodeId}`);

    await restoreNodeRecursive(root, nodeId);
    await persistAllNodes(root);
    logger.debug(`Restored node tree starting at ${safeNodeId} from trash.`);
    return node;
  },

  async permanentlyDeleteNode(nodeId) {
    const root = await this.ensureInitialized();
    const safeNodeId = assertNonEmptyString(nodeId, VFS_CONSTANTS.FIELD_NODE_ID);
    const node = workspaceState.nodes.get(safeNodeId);
    if (!node || !node.trashed) throw new Error(`Node not found in trash: ${safeNodeId}`);

    await permanentlyDeleteNodeRecursive(root, nodeId);
    await persistAllNodes(root);
    logger.debug(`Permanently deleted node tree starting at ${safeNodeId}.`);
    return true;
  },

  async emptyTrash() {
    const root = await this.ensureInitialized();
    const trashedNodes = Array.from(workspaceState.nodes.values()).filter((node) => node.trashed);

    for (const node of trashedNodes) {
      await permanentlyDeleteNodeRecursive(root, node.id);
    }

    await persistAllNodes(root);
    logger.debug(`Emptied trash, removed ${trashedNodes.length} top-level node tree(s).`);
    return true;
  },

  async confirmPermanentDeleteNode() {
    const { response } = await dialog.showMessageBox(getFocusedWindow(), {
      type: 'warning',
      buttons: [$t('dialog.cancel'), $t('trash.deletePermanently')],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
      title: $t('label.trash'),
      message: $t('trash.permanentDeleteConfirm'),
    });

    return response === 1;
  },

  async confirmEmptyTrash() {
    const { response } = await dialog.showMessageBox(getFocusedWindow(), {
      type: 'warning',
      buttons: [$t('dialog.cancel'), $t('trash.empty')],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
      title: $t('label.trash'),
      message: $t('trash.emptyConfirm'),
    });

    return response === 1;
  },

  async confirmDeleteNode(name) {
    const displayName = typeof name === 'string' && name.trim().length > 0
      ? name.trim()
      : $t('default.thisItem');

    const { response } = await dialog.showMessageBox(getFocusedWindow(), {
      type: 'warning',
      buttons: [$t('dialog.cancel'), $t('dialog.ok')],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
      title: $t('common.deleteNode'),
      message: interpolateMessage($t('dialog.deleteConfirm'), { name: displayName }),
    });

    return response === 1;
  },

  async confirmRecoverVersion() {
    const { response } = await dialog.showMessageBox(getFocusedWindow(), {
      type: 'warning',
      buttons: [$t('dialog.cancel'), $t('history.restore')],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
      title: $t('history.title'),
      message: $t('history.restoreConfirm'),
    });

    return response === 1;
  },

  async autoClearTrash(root) {
    try {
      const config = await settingsService.loadConfig();
      const days = config.trashAutoClearDays;
      if (!days || days <= 0) return;

      const threshold = Date.now() - (days * 24 * 60 * 60 * 1000);
      const trashedNodes = Array.from(workspaceState.nodes.values()).filter(
        (node) => node.trashed && (node.updatedAt || node.createdAt) < threshold
      );

      if (trashedNodes.length === 0) return;

      for (const node of trashedNodes) {
        await permanentlyDeleteNodeRecursive(root, node.id);
      }

      await persistAllNodes(root);
      logger.info(`Auto-cleared ${trashedNodes.length} expired trashed nodes (older than ${days} days).`);
    } catch (error) {
      logger.error(`Error during auto clear trash: ${error.message}`);
    }
  },
};

async function deleteNodeRecursive(root, nodeId, isRoot = true) {
  const safeNodeId = assertNonEmptyString(nodeId, VFS_CONSTANTS.FIELD_NODE_ID);
  const node = workspaceState.nodes.get(safeNodeId);
  if (!node) return;

  if (node.type === VFS_CONSTANTS.NODE_TYPE_FOLDER) {
    const children = Array.from(workspaceState.nodes.values()).filter(
      (n) => n.parentId === node.id && !n.trashed,
    );
    for (const child of children) {
      await deleteNodeRecursive(root, child.id, false);
    }
  }

  if (node.type === VFS_CONSTANTS.NODE_TYPE_FILE && node.contentId) {
    const source = getObjectFilePath(root, node.contentId);
    const destination = path.join(trashDir(root), `${node.contentId}${VFS_CONSTANTS.MARKDOWN_FILE_EXT}`);
    if (await pathExists(source)) await fs.rename(source, destination);
  }

  if (isRoot) {
    node.trashed = true;
    node.updatedAt = Date.now();
    workspaceState.nodes.set(node.id, node);
    logger.debug(`Marked root node ${safeNodeId} as trashed.`);
  }

  logger.debug(`Processed node ${safeNodeId} for trash.`);
}

async function restoreNodeRecursive(root, nodeId) {
  const node = workspaceState.nodes.get(nodeId);
  if (!node) return;

  if (node.type === VFS_CONSTANTS.NODE_TYPE_FILE && node.contentId) {
    const source = path.join(trashDir(root), `${node.contentId}${VFS_CONSTANTS.MARKDOWN_FILE_EXT}`);
    const destination = getObjectFilePath(root, node.contentId);
    if (await pathExists(source)) await fs.rename(source, destination);
  }

  node.trashed = false;
  node.updatedAt = Date.now();
  workspaceState.nodes.set(node.id, node);

  if (node.type === VFS_CONSTANTS.NODE_TYPE_FOLDER) {
    const children = Array.from(workspaceState.nodes.values()).filter(
      (n) => n.parentId === node.id && !n.trashed,
    );
    for (const child of children) {
      await restoreNodeRecursive(root, child.id);
    }
  }
}

async function permanentlyDeleteNodeRecursive(root, nodeId) {
  const node = workspaceState.nodes.get(nodeId);
  if (!node) return;

  if (node.type === VFS_CONSTANTS.NODE_TYPE_FOLDER) {
    const children = Array.from(workspaceState.nodes.values()).filter(
      (n) => n.parentId === node.id,
    );
    for (const child of children) {
      await permanentlyDeleteNodeRecursive(root, child.id);
    }
  }

  if (node.type === VFS_CONSTANTS.NODE_TYPE_FILE && node.contentId) {
    const filePath = path.join(trashDir(root), `${node.contentId}${VFS_CONSTANTS.MARKDOWN_FILE_EXT}`);
    if (await pathExists(filePath)) await fs.unlink(filePath);

    const imageDirectory = getContentImagesDir(root, node.contentId);
    if (await pathExists(imageDirectory)) {
      await fs.rm(imageDirectory, { recursive: true, force: true });
    }
  }

  workspaceState.nodes.delete(nodeId);
}

function countDescendants(parentId) {
  const children = Array.from(workspaceState.nodes.values()).filter(
    (n) => n.parentId === parentId,
  );
  let total = children.length;
  for (const child of children) {
    if (child.type === VFS_CONSTANTS.NODE_TYPE_FOLDER) {
      total += countDescendants(child.id);
    }
  }
  return total;
}
