import { app, ipcMain } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { IPC_CHANNELS } from '../constants/channels.js';
import { writeUtf8 } from '../services/file.service.js';

// VFS Core Functions
function getDefaultWorkspaceRoot() {
  const appName = 'Pilotra';
  return path.join(app.getPath('documents'), appName);
}

function databaseDir(root) { return path.join(root, 'Database'); }
function objectsDir(root) { return path.join(databaseDir(root), 'objects'); }
function trashDir(root) { return path.join(databaseDir(root), 'trash'); }
function nodesFile(root) { return path.join(databaseDir(root), 'nodes.jsonl'); }
function metaFile(root) { return path.join(databaseDir(root), 'meta.json'); }

async function ensureWorkspaceStructure(root) {
  const nwd = databaseDir(root);
  const obj = objectsDir(root);
  const tr = trashDir(root);

  await fs.mkdir(nwd, { recursive: true });
  await fs.mkdir(obj, { recursive: true });
  await fs.mkdir(tr, { recursive: true });

  const nf = nodesFile(root);
  try { await fs.access(nf); } catch (e) { await writeUtf8(nf, ''); }

  const mf = metaFile(root);
  try {
    await fs.access(mf);
  } catch (e) {
    const meta = { workspaceId: crypto.randomUUID(), version: 1, createdAt: Date.now(), lastOpenedAt: Date.now() };
    await writeUtf8(mf, JSON.stringify(meta, null, 2));
  }
}

async function loadAllNodes(root) {
  const file = nodesFile(root);
  const nodes = new Map();
  try {
    const content = await fs.readFile(file, 'utf-8');
    const lines = content.split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      try {
        const n = JSON.parse(line);
        nodes.set(n.id, n);
      } catch (_) { }
    }
  } catch (err) {
    console.error('File might not exist or be unreadable:', err);
  }
  return nodes;
}

async function persistAllNodes(root, nodesMap) {
  const lines = Array.from(nodesMap.values()).map(n => JSON.stringify(n));
  const tmp = nodesFile(root) + '.tmp';

  await writeUtf8(tmp, lines.join('\n') + (lines.length ? '\n' : ''));
  await fs.rename(tmp, nodesFile(root));
}

let activeWorkspaceRoot = null;
let activeNodes = new Map();

async function initWorkspace(rootPath) {
  const root = rootPath || getDefaultWorkspaceRoot();
  await ensureWorkspaceStructure(root);

  activeWorkspaceRoot = root;
  activeNodes = await loadAllNodes(root);

  return { root, nodes: Array.from(activeNodes.values()) };
}

async function createFile(parentId, name, content = '') {
  if (!activeWorkspaceRoot) {
    await initWorkspace(); // Auto-init if not done yet
  }

  const contentId = crypto.randomUUID();
  const filePath = path.join(objectsDir(activeWorkspaceRoot), `${contentId}.md`);
  const fileContent = content || `# ${name}\n\n`;

  await writeUtf8(filePath, fileContent);

  const displayName = name.endsWith('.md') ? name.slice(0, -3) : name;
  const node = {
    id: crypto.randomUUID(),
    type: 'file',
    name: displayName,
    fileName: `${contentId}.md`,
    parentId,
    order: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    contentId,
    trashed: false,
    locked: false,
  };

  activeNodes.set(node.id, node);
  await persistAllNodes(activeWorkspaceRoot, activeNodes);

  return node;
}

async function readContent(contentId) {
  if (!activeWorkspaceRoot) throw new Error('Workspace not initialized');
  const p = path.join(objectsDir(activeWorkspaceRoot), `${contentId}.md`);
  try {
    return await fs.readFile(p, 'utf-8');
  } catch (e) {
    return '';
  }
}

async function writeContent(contentId, text) {
  if (!activeWorkspaceRoot) throw new Error('Workspace not initialized');
  if (text === undefined || text === null) return false;

  const p = path.join(objectsDir(activeWorkspaceRoot), `${contentId}.md`);
  const tmpPath = p + '.tmp';
  const backupPath = p + '.bak';

  try {
    await writeUtf8(tmpPath, text);
    try {
      const original = await fs.readFile(p, 'utf-8');
      if (original.length > 0) await writeUtf8(backupPath, original);
    } catch (e) { }
    await fs.rename(tmpPath, p);
    try { await fs.unlink(backupPath); } catch (e) { }
    return true;
  } catch (err) {
    try { await fs.unlink(tmpPath); } catch (e) { }
    return false;
  }
}

export function registerVfsIpcHandlers() {
  ipcMain.handle(IPC_CHANNELS.VFS_INIT, async (_e, rootPath) => {
    return await initWorkspace(rootPath);
  });

  ipcMain.handle(IPC_CHANNELS.VFS_CREATE_FILE, async (_e, payload) => {
    const { parentId, name, content } = payload;
    return await createFile(parentId, name, content);
  });

  ipcMain.handle(IPC_CHANNELS.VFS_READ_CONTENT, async (_e, contentId) => {
    return await readContent(contentId);
  });

  ipcMain.handle(IPC_CHANNELS.VFS_WRITE_CONTENT, async (_e, payload) => {
    return await writeContent(payload.contentId, payload.content);
  });
}
