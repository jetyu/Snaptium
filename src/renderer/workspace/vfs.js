import state from '../state.js';

const electronAPI = window.electronAPI;

if (!electronAPI) {
  throw new Error('electronAPI 未初始化，无法在渲染进程访问受信任的 Node API');
}

const {
  fs: electronFs,
  path: electronPath,
  os: electronOs,
  ipcRenderer,
} = electronAPI;

function randomId() {
  if (typeof crypto !== 'undefined') {
    if (crypto.randomUUID) {
      return crypto.randomUUID();
    }
    if (crypto.getRandomValues) {
      const buffer = new Uint8Array(16);
      crypto.getRandomValues(buffer);
      return Array.from(buffer, (b) => b.toString(16).padStart(2, '0')).join('');
    }
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function getDefaultWorkspaceRoot() {
  const appName = 'NoteWizard';
  const platform = electronOs.platform();
  const homeDir = electronOs.homedir() || '';

  if (platform === 'win32') {
    return electronPath.join(homeDir, 'Documents', appName);
  }
  if (platform === 'darwin') {
    return electronPath.join(homeDir, 'Library', 'Application Support', appName);
  }
  return electronPath.join(homeDir, `.${appName}`);
}

function nwDir(root) {
  return electronPath.join(root, 'Database');
}

function objectsDir(root) {
  return electronPath.join(nwDir(root), 'objects');
}

function trashDir(root) {
  return electronPath.join(nwDir(root), 'trash');
}

function nodesFile(root) {
  return electronPath.join(nwDir(root), 'nodes.jsonl');
}

function metaFile(root) {
  return electronPath.join(nwDir(root), 'meta.json');
}

function ensureWorkspaceStructure(root) {
  const nwd = nwDir(root);
  const obj = objectsDir(root);
  const tr = trashDir(root);
  if (!electronFs.existsSync(nwd)) electronFs.mkdirSync(nwd, { recursive: true });
  if (!electronFs.existsSync(obj)) electronFs.mkdirSync(obj, { recursive: true });
  if (!electronFs.existsSync(tr)) electronFs.mkdirSync(tr, { recursive: true });
  if (!electronFs.existsSync(nodesFile(root))) electronFs.writeFileSync(nodesFile(root), '', 'utf-8');
  if (!electronFs.existsSync(metaFile(root))) {
    const meta = { workspaceId: randomId(), version: 1, createdAt: Date.now(), lastOpenedAt: Date.now() };
    electronFs.writeFileSync(metaFile(root), JSON.stringify(meta, null, 2), 'utf-8');
  }
}

function loadAllNodes(root) {
  const file = nodesFile(root);
  const nodes = new Map();
  if (!electronFs.existsSync(file)) return nodes;
  const content = electronFs.readFileSync(file, 'utf-8');
  const lines = content.split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    try {
      const n = JSON.parse(line);
      nodes.set(n.id, n);
    } catch (_) {}
  }
  return nodes;
}

function persistAllNodes(root, nodesMap) {
  const lines = [];
  for (const n of nodesMap.values()) {
    lines.push(JSON.stringify(n));
  }
  const tmp = nodesFile(root) + '.tmp';
  electronFs.writeFileSync(tmp, lines.join('\n') + (lines.length ? '\n' : ''), 'utf-8');
  electronFs.renameSync(tmp, nodesFile(root));
}

async function initWorkspace(rootPath) {
  // 从 preferences.json 读取保存路径
  let savedPath = null;
  if (!rootPath) {
    try {
      savedPath = await ipcRenderer.invoke('preferences:get', 'noteSavePath', null);
    } catch (error) {
      console.error('Failed to get noteSavePath from preferences:', error);
    }
  }
  
  let root = rootPath || savedPath || getDefaultWorkspaceRoot();

  try {
    if (!electronFs.existsSync(root)) {
      electronFs.mkdirSync(root, { recursive: true });
    }
  } catch (error) {
    root = getDefaultWorkspaceRoot();
  }

  ensureWorkspaceStructure(root);

  const nodes = loadAllNodes(root);
  state.workspaceRoot = root;
  state.nodes = nodes;

  // 保存到 preferences.json
  try {
    await ipcRenderer.invoke('preferences:set', 'noteSavePath', root);
  } catch (error) {
    console.error('Failed to save noteSavePath to preferences:', error);
  }

  return { root, nodes };
}

function listChildren(parentId, includeTrashed = false) {
  const arr = [];
  for (const n of state.nodes.values()) {
    if (n.parentId === parentId && (includeTrashed || !n.trashed)) {
      arr.push(n);
    }
  }
  arr.sort((a, b) => (a.order - b.order) || a.name.localeCompare(b.name, 'zh-Hans-CN'));
  return arr;
}

function saveNode(node) {
  node.updatedAt = Date.now();
  if (node.type === 'file' && !node.fileName && node.contentId) {
    node.fileName = `${node.contentId}.md`;
  }
  state.nodes.set(node.id, node);
  persistAllNodes(state.workspaceRoot, state.nodes);
  return node;
}

function createFolder(parentId, name) {
  const node = {
    id: randomId(),
    type: 'folder',
    name,
    parentId,
    order: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    trashed: false,
  };
  return saveNode(node);
}

function createFile(parentId, name, content = '') {
  const contentId = randomId();
  const filePath = electronPath.join(objectsDir(state.workspaceRoot), `${contentId}.md`);
  const fileContent = content || `# ${name}\n\n`;
  electronFs.writeFileSync(filePath, fileContent, 'utf-8');

  const displayName = name.endsWith('.md') ? name.slice(0, -3) : name;

  const node = {
    id: randomId(),
    type: 'file',
    name: displayName,
    fileName: `${contentId}.md`,
    parentId,
    order: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    contentId,
    trashed: false,
  };
  return saveNode(node);
}

function getNodeById(id) {
  return state.nodes.get(id) || null;
}

function moveNode(id, newParentId, newOrder) {
  const node = getNodeById(id);
  if (!node) return null;
  node.parentId = newParentId;
  if (newOrder != null) node.order = newOrder;
  return saveNode(node);
}

function renameNode(id, newName) {
  const node = getNodeById(id);
  if (!node) return null;
  node.name = newName;
  return saveNode(node);
}

function restoreNode(id) {
  const node = getNodeById(id);
  if (!node || !node.trashed) return false;

  // 先恢复所有父级节点（如果父级节点也被删除了）
  if (node.parentId) {
    const parent = getNodeById(node.parentId);
    if (parent && parent.trashed) {
      restoreNode(node.parentId);
    }
  }

  // 恢复当前节点
  node.trashed = false;
  delete node.trashedAt;

  if (node.type === 'file' && node.contentId) {
    const trashPath = electronPath.join(trashDir(state.workspaceRoot), `${node.contentId}.md`);
    const targetPath = electronPath.join(objectsDir(state.workspaceRoot), `${node.contentId}.md`);

    if (electronFs.existsSync(trashPath)) {
      electronFs.renameSync(trashPath, targetPath);
    }
  }

  // 恢复所有子节点
  const children = listChildren(id, true);
  for (const child of children) {
    restoreNode(child.id);
  }

  persistAllNodes(state.workspaceRoot, state.nodes);
  return true;
}

function deleteNode(id, permanent = false) {
  const node = getNodeById(id);
  if (!node) return false;

  if (permanent) {
    if (node.type === 'file' && node.contentId) {
      const baseDir = node.trashed ? trashDir(state.workspaceRoot) : objectsDir(state.workspaceRoot);
      const contentPath = electronPath.join(baseDir, `${node.contentId}.md`);
      if (electronFs.existsSync(contentPath)) {
        electronFs.unlinkSync(contentPath);
      }
      
      // 删除对应的图片文件夹
      const imagesDir = electronPath.join(state.workspaceRoot, 'Database', 'images', node.contentId);
      if (electronFs.existsSync(imagesDir)) {
        try {
          electronFs.rmSync(imagesDir, { recursive: true, force: true });
          console.log(`[VFS] Deleted images folder: ${imagesDir}`);
        } catch (error) {
          console.warn(`[VFS] Failed to delete images folder: ${imagesDir}`, error);
        }
      }
    }
    state.nodes.delete(id);
    const children = listChildren(id, true);
    for (const child of children) {
      deleteNode(child.id, true);
    }
  } else {
    node.trashed = true;
    node.trashedAt = new Date().toISOString();
    if (node.type === 'file' && node.contentId) {
      const sourcePath = electronPath.join(objectsDir(state.workspaceRoot), `${node.contentId}.md`);
      const trashPath = electronPath.join(trashDir(state.workspaceRoot), `${node.contentId}.md`);

      if (!electronFs.existsSync(trashDir(state.workspaceRoot))) {
        electronFs.mkdirSync(trashDir(state.workspaceRoot), { recursive: true });
      }

      if (electronFs.existsSync(sourcePath)) {
        electronFs.renameSync(sourcePath, trashPath);
      }
    }
    const children = listChildren(id, true);
    for (const child of children) {
      deleteNode(child.id, false);
    }
  }

  persistAllNodes(state.workspaceRoot, state.nodes);
  return true;
}

async function readContent(contentId) {
  const p = electronPath.join(objectsDir(state.workspaceRoot), `${contentId}.md`);
  if (electronFs.existsSync(p)) {
    let content = electronFs.readFileSync(p, 'utf-8');
    
    // 双重验证：检查 meta.json 的加密状态和文件内容的 ENCRYPTED: 前缀
    const metaPath = electronPath.join(nwDir(state.workspaceRoot), 'meta.json');
    let metaEncrypted = false;
    
    try {
      if (electronFs.existsSync(metaPath)) {
        const metaContent = electronFs.readFileSync(metaPath, 'utf-8');
        const meta = JSON.parse(metaContent);
        metaEncrypted = meta.encrypted === true;
      }
    } catch (error) {
      console.warn('Failed to read meta.json encryption status:', error);
    }
    
    // 如果是加密内容（文件内容以 ENCRYPTED: 开头），调用 IPC 解密
    if (content.startsWith('ENCRYPTED:')) {
      // 验证 meta.json 的加密状态是否一致
      if (!metaEncrypted) {
        console.warn(`[VFS] Inconsistent encryption state: file ${contentId}.md is encrypted but meta.json shows encrypted=false`);
      }
      
      try {
        const result = await ipcRenderer.invoke('encryption:decrypt-note', { content });
        if (result.success) {
          return result.decrypted;
        } else {
          console.error('解密失败:', result.error);
          return content; // 解密失败，返回原内容
        }
      } catch (error) {
        console.error('调用解密 IPC 失败:', error);
        return content;
      }
    } else {
      // 文件未加密，但 meta.json 显示已加密，发出警告
      if (metaEncrypted) {
        console.warn(`[VFS] Inconsistent encryption state: file ${contentId}.md is not encrypted but meta.json shows encrypted=true`);
      }
    }
    
    return content;
  }
  return '';
}

async function writeContent(contentId, text) {
  // 验证内容有效性，防止写入空内容导致数据丢失
  if (text === undefined || text === null) {
    console.error('[VFS] writeContent: Content is invalid');
    return false;
  }
  
  const p = electronPath.join(objectsDir(state.workspaceRoot), `${contentId}.md`);
  const tmpPath = p + '.tmp';
  const backupPath = p + '.bak';
  
  let contentToWrite = text;
  
  // 检查是否启用加密
  try {
    const statusResult = await ipcRenderer.invoke('encryption:is-enabled');
    if (statusResult.success && statusResult.enabled) {
      // 加密内容
      const encryptResult = await ipcRenderer.invoke('encryption:encrypt-note', { content: text });
      if (encryptResult.success) {
        contentToWrite = encryptResult.encrypted;
      } else {
        // 加密失败，使用原内容继续保存
        console.error('[VFS] 加密失败:', encryptResult.error);
      }
    }
  } catch (error) {
    // IPC 失败时，继续使用原内容保存。
    console.error('[VFS] 检查加密状态失败:', error);
    
  }
  
  // 再次验证：确保最终要写入的内容有效
  if (contentToWrite === undefined || contentToWrite === null || 
      (typeof contentToWrite === 'string' && contentToWrite.length === 0 && text.length > 0)) {
    console.error('[VFS] writeContent: 处理后内容异常，跳过写入以保护数据');
    return false;
  }
  
  try {
    // 原子写入：先写临时文件
    electronFs.writeFileSync(tmpPath, contentToWrite, 'utf-8');
    
    // 验证临时文件写入成功
    const writtenContent = electronFs.readFileSync(tmpPath, 'utf-8');
    if (writtenContent !== contentToWrite) {
      console.error('[VFS] writeContent: 临时文件验证失败，内容不匹配');
      if (electronFs.existsSync(tmpPath)) electronFs.unlinkSync(tmpPath);
      return false;
    }
    
    // 如果原文件存在且有内容，创建备份
    if (electronFs.existsSync(p)) {
      const originalContent = electronFs.readFileSync(p, 'utf-8');
      if (originalContent.length > 0) {
        electronFs.writeFileSync(backupPath, originalContent, 'utf-8');
      }
    }
    
    // 原子替换：重命名临时文件为目标文件
    electronFs.renameSync(tmpPath, p);
    
    // 写入成功后删除备份文件
    if (electronFs.existsSync(backupPath)) {
      electronFs.unlinkSync(backupPath);
    }
    
    return true;
  } catch (error) {
    console.error('[VFS] writeContent: 写入失败:', error);
    // 清理临时文件
    if (electronFs.existsSync(tmpPath)) {
      try { electronFs.unlinkSync(tmpPath); } catch (_) {}
    }
    return false;
  }
}

function emptyTrash() {
  const trashedRoots = [];
  for (const node of state.nodes.values()) {
    if (node.trashed) {
      const parent = node.parentId ? getNodeById(node.parentId) : null;
      if (!parent || !parent.trashed) {
        trashedRoots.push(node);
      }
    }
  }

  for (const n of trashedRoots) {
    deleteNode(n.id, true);
  }

  return trashedRoots.length;
}

/**
 * 搜索节点(基于内存中的 state.nodes)
 * @param {string} query - 搜索关键词
 * @param {Object} options - 搜索选项
 * @returns {Array} 匹配的节点数组
 */
function searchNodes(query, options = {}) {
  const {
    caseSensitive = false,
    includeFiles = true,
    includeFolders = false,
    includeTrashed = false
  } = options;
  
  if (!query || query.trim() === '') return [];
  
  const results = [];
  const searchQuery = caseSensitive ? query : query.toLowerCase();
  
  // 直接遍历内存中的 Map,无IO操作
  for (const node of state.nodes.values()) {
    if (node.type === 'file' && !includeFiles) continue;
    if (node.type === 'folder' && !includeFolders) continue;
    if (node.trashed && !includeTrashed) continue;
    
    const nodeName = caseSensitive ? node.name : node.name.toLowerCase();
    if (nodeName.includes(searchQuery)) {
      results.push(node);
    }
  }
  
  return results;
}

/**
 * 全文搜索节点（搜索标题和内容）
 * @param {string} query - 搜索关键词
 * @param {Object} options - 搜索选项
 * @param {Function} onProgress - 进度回调函数
 * @returns {Promise<Array>} 匹配的节点数组，包含匹配信息
 */
async function searchNodesFullText(query, options = {}, onProgress = null) {
  const {
    caseSensitive = false,
    searchIn = 'all', // 'title', 'content', 'all'
    includeTrashed = false,
    maxResults = 100,
    maxNodes = 1000,
    batchSize = 50
  } = options;
  
  if (!query || query.trim() === '') return [];
  
  const results = [];
  const searchQuery = caseSensitive ? query : query.toLowerCase();
  
  // 获取所有文件节点
  const fileNodes = [];
  for (const node of state.nodes.values()) {
    if (node.type !== 'file') continue;
    if (node.trashed && !includeTrashed) continue;
    fileNodes.push(node);
  }
  
  // 按更新时间排序，优先搜索最近的笔记
  fileNodes.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  
  // 限制搜索范围
  const nodesToSearch = fileNodes.slice(0, maxNodes);
  const totalNodes = nodesToSearch.length;
  
  // 分批处理
  for (let i = 0; i < nodesToSearch.length; i += batchSize) {
    // 检查是否已达到最大结果数
    if (results.length >= maxResults) break;
    
    const batch = nodesToSearch.slice(i, i + batchSize);
    const batchPromises = batch.map(async (node) => {
      try {
        const matchInfo = {
          node,
          matchInTitle: false,
          matchInContent: false,
          matches: []
        };
        
        // 搜索标题
        if (searchIn === 'title' || searchIn === 'all') {
          const nodeName = caseSensitive ? node.name : node.name.toLowerCase();
          if (nodeName.includes(searchQuery)) {
            matchInfo.matchInTitle = true;
            matchInfo.matches.push({
              type: 'title',
              text: node.name,
              position: nodeName.indexOf(searchQuery)
            });
          }
        }
        
        // 搜索内容
        if ((searchIn === 'content' || searchIn === 'all') && node.contentId) {
          const content = await readContent(node.contentId);
          const searchContent = caseSensitive ? content : content.toLowerCase();
          
          if (searchContent.includes(searchQuery)) {
            matchInfo.matchInContent = true;
            
            // 提取匹配的上下文（最多3个）
            const contextMatches = extractContextMatches(content, query, caseSensitive, 3);
            matchInfo.matches.push(...contextMatches);
          }
        }
        
        // 如果有匹配，返回结果
        if (matchInfo.matchInTitle || matchInfo.matchInContent) {
          return matchInfo;
        }
        
        return null;
      } catch (error) {
        console.warn(`搜索节点 ${node.id} 时出错:`, error);
        return null;
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    
    // 收集有效结果
    for (const result of batchResults) {
      if (result && results.length < maxResults) {
        results.push(result);
      }
    }
    
    // 报告进度
    if (onProgress) {
      const progress = Math.min(100, Math.round(((i + batch.length) / totalNodes) * 100));
      onProgress({
        current: i + batch.length,
        total: totalNodes,
        progress,
        resultsCount: results.length
      });
    }
  }
  
  return results;
}

/**
 * 提取匹配关键词的上下文
 * @param {string} content - 文本内容
 * @param {string} query - 搜索关键词
 * @param {boolean} caseSensitive - 是否区分大小写
 * @param {number} maxMatches - 最多返回几个匹配
 * @returns {Array} 匹配的上下文数组
 */
function extractContextMatches(content, query, caseSensitive, maxMatches = 3) {
  const matches = [];
  const searchContent = caseSensitive ? content : content.toLowerCase();
  const searchQuery = caseSensitive ? query : query.toLowerCase();
  const contextLength = 50; // 前后各50个字符
  
  let startIndex = 0;
  let matchCount = 0;
  
  while (matchCount < maxMatches) {
    const index = searchContent.indexOf(searchQuery, startIndex);
    if (index === -1) break;
    
    // 计算上下文范围
    const contextStart = Math.max(0, index - contextLength);
    const contextEnd = Math.min(content.length, index + query.length + contextLength);
    
    // 提取上下文
    let contextText = content.substring(contextStart, contextEnd);
    
    // 添加省略号
    if (contextStart > 0) contextText = '...' + contextText;
    if (contextEnd < content.length) contextText = contextText + '...';
    
    // 计算行号
    const lineNumber = content.substring(0, index).split('\n').length;
    
    matches.push({
      type: 'content',
      text: contextText,
      position: index,
      line: lineNumber,
      matchStart: contextStart > 0 ? index - contextStart + 3 : index - contextStart,
      matchLength: query.length
    });
    
    matchCount++;
    startIndex = index + query.length;
  }
  
  return matches;
}

/**
 * 获取节点的完整路径
 * @param {string} nodeId - 节点ID
 * @returns {Array} 从根到该节点的路径数组
 */
function getNodePath(nodeId) {
  const path = [];
  let current = state.nodes.get(nodeId);
  
  while (current) {
    path.unshift(current);
    current = current.parentId ? state.nodes.get(current.parentId) : null;
  }
  
  return path;
}

export {
  getDefaultWorkspaceRoot,
  initWorkspace,
  listChildren,
  createFolder,
  createFile,
  moveNode,
  renameNode,
  deleteNode,
  restoreNode,
  getNodeById,
  readContent,
  writeContent,
  emptyTrash,
  searchNodes,
  searchNodesFullText,
  getNodePath,
};
