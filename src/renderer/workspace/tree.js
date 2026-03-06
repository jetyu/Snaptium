import * as vfs from './vfs.js';
import { t } from '../i18n.js';

// 跟踪展开的文件夹ID
let expandedFolders = new Set();

let handlers = {
  onSelect: null, // function(node)
  onContext: null, // function(node, event)
  onMove: null, // function(sourceId, targetNode, position)
  onInlineRenameCommit: null, // function(node, newName)
};

// 自动滚动相关变量
let autoScrollInterval = null;
const SCROLL_SPEED = 10; // 每次滚动的像素
const SCROLL_ZONE = 50; // 触发滚动的边缘区域大小（像素）

// 多选相关变量
let selectedNodes = new Set(); // 当前选中的节点ID集合
let lastClickedNodeId = null; // 上次点击的节点ID，用于Shift范围选择

function setHandlers(h) {
  handlers = { ...handlers, ...(h || {}) };
}

/**
 * 获取拖拽位置 ('before', 'after', 'inside')
 * @param {DragEvent} e 
 * @param {HTMLElement} row 
 * @param {Object} node 
 */
function getDropPosition(e, row, node) {
  const rect = row.getBoundingClientRect();
  const y = e.clientY - rect.top;
  const height = rect.height;

  if (node.type === 'folder') {
    if (y < height * 0.25) return 'before';
    if (y > height * 0.75) return 'after';
    return 'inside';
  } else {
    return y < height * 0.5 ? 'before' : 'after';
  }
}

/**
 * 清除所有拖拽状态类
 */
function clearDragOverStyles() {
  document.querySelectorAll('.drag-over-before, .drag-over-after, .drag-over-inside').forEach(el => {
    el.classList.remove('drag-over-before', 'drag-over-after', 'drag-over-inside');
  });
}
/**
 * 只读模式图标
 * @param {Object} node - 节点对象
 * @returns {HTMLElement} 锁定图标元素
 */
function createLockIcon(node) {
  const lockIcon = document.createElement('span');
  lockIcon.className = 'lock-icon';
  lockIcon.textContent = node.locked ? '🔐' : '';
  lockIcon.title = t('readOnly.tooltip');
  return lockIcon;
}

/**
 * 处理拖拽时的自动滚动
 * @param {DragEvent} e - 拖拽事件
 * @param {HTMLElement} container - 滚动容器
 */
function handleAutoScroll(e, container) {
  if (!container) return;

  const rect = container.getBoundingClientRect();
  const mouseY = e.clientY;

  // 清除之前的滚动定时器
  if (autoScrollInterval) {
    clearInterval(autoScrollInterval);
    autoScrollInterval = null;
  }

  // 检查是否在顶部边缘区域
  if (mouseY < rect.top + SCROLL_ZONE) {
    autoScrollInterval = setInterval(() => {
      container.scrollTop -= SCROLL_SPEED;
      if (container.scrollTop <= 0) {
        clearInterval(autoScrollInterval);
        autoScrollInterval = null;
      }
    }, 20);
  }
  // 检查是否在底部边缘区域
  else if (mouseY > rect.bottom - SCROLL_ZONE) {
    autoScrollInterval = setInterval(() => {
      const maxScroll = container.scrollHeight - container.clientHeight;
      container.scrollTop += SCROLL_SPEED;
      if (container.scrollTop >= maxScroll) {
        clearInterval(autoScrollInterval);
        autoScrollInterval = null;
      }
    }, 20);
  }
}

/**
 * 停止自动滚动
 */
function stopAutoScroll() {
  if (autoScrollInterval) {
    clearInterval(autoScrollInterval);
    autoScrollInterval = null;
  }
}

/**
 * 获取所有可见节点的ID列表（按DOM顺序）
 */
function getAllVisibleNodeIds() {
  const nodeIds = [];
  document.querySelectorAll('.tree-item').forEach(item => {
    if (item.style.display !== 'none') {
      nodeIds.push(item.dataset.nodeId);
    }
  });
  return nodeIds;
}

/**
 * 更新选中状态的视觉显示
 */
function updateSelectionUI() {
  document.querySelectorAll('.tree-row').forEach(row => {
    const item = row.closest('.tree-item');
    if (item && selectedNodes.has(item.dataset.nodeId)) {
      row.classList.add('selected');
    } else {
      row.classList.remove('selected');
    }
  });
}

/**
 * 清除所有选中状态
 */
function clearSelection() {
  selectedNodes.clear();
  updateSelectionUI();
}

/**
 * 处理节点点击（支持Ctrl和Shift多选）
 */
function handleNodeClick(node, event, row) {
  const nodeId = node.id;

  if (event.ctrlKey || event.metaKey) {
    // Ctrl/Cmd + 点击：切换单个节点的选中状态
    if (selectedNodes.has(nodeId)) {
      selectedNodes.delete(nodeId);
      row.classList.remove('selected');
    } else {
      selectedNodes.add(nodeId);
      row.classList.add('selected');
    }
    lastClickedNodeId = nodeId;
  } else if (event.shiftKey && lastClickedNodeId) {
    // Shift + 点击：选中范围
    const allNodeIds = getAllVisibleNodeIds();
    const lastIndex = allNodeIds.indexOf(lastClickedNodeId);
    const currentIndex = allNodeIds.indexOf(nodeId);

    if (lastIndex !== -1 && currentIndex !== -1) {
      const start = Math.min(lastIndex, currentIndex);
      const end = Math.max(lastIndex, currentIndex);

      // 清除之前的选择
      clearSelection();

      // 选中范围内的所有节点
      for (let i = start; i <= end; i++) {
        selectedNodes.add(allNodeIds[i]);
      }
      updateSelectionUI();
    }
  } else {
    // 普通点击：清除其他选择，只选中当前节点
    clearSelection();
    selectedNodes.add(nodeId);
    row.classList.add('selected');
    lastClickedNodeId = nodeId;

    // 移除active类（用selected替代）
    document.querySelectorAll('.tree-row.active').forEach(x => x.classList.remove('active'));
    row.classList.add('active');

    // 触发选择回调
    if (handlers.onSelect) handlers.onSelect(node);
  }
}

function buildTreeDom(parentId) {
  const ul = document.createElement('ul');
  ul.className = 'tree-level';
  const children = vfs.listChildren(parentId);
  children.forEach((node) => {
    const li = document.createElement('li');
    li.className = 'tree-item ' + (node.type === 'folder' ? 'folder' : 'file');
    li.dataset.nodeId = node.id;

    const row = document.createElement('div');
    row.className = 'tree-row';
    row.draggable = true;
    const icon = document.createElement('span');
    icon.className = 'tree-icon';
    icon.textContent = node.type === 'folder' ? '📓' : '📄';
    const label = document.createElement('span');
    label.className = 'tree-label';
    label.textContent = node.name;

    row.appendChild(icon);
    row.appendChild(label);
    row.appendChild(createLockIcon(node));
    li.appendChild(row);

    row.addEventListener('click', (e) => {
      // 处理多选
      handleNodeClick(node, e, row);

      // 文件夹展开/折叠逻辑（仅在非多选模式下）
      if (node.type === 'folder' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        const wasExpanded = li.classList.contains('expanded');
        li.classList.toggle('expanded');
        const existing = li.querySelector(':scope > ul.tree-level');

        if (li.classList.contains('expanded')) {
          if (existing) existing.remove();
          li.appendChild(buildTreeDom(node.id));
          if (!wasExpanded) {
            expandedFolders.add(node.id);
          }
        } else {
          if (existing) existing.remove();
          expandedFolders.delete(node.id);
        }
      }
    });

    row.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (handlers.onContext) handlers.onContext(node, e);
    });

    // 拖拽源
    row.addEventListener('dragstart', (e) => {
      // 如果拖拽的节点不在选中列表中，清除选择并只选中当前节点
      if (!selectedNodes.has(node.id)) {
        clearSelection();
        selectedNodes.add(node.id);
        row.classList.add('selected');
      }

      // 传递所有选中的节点ID（用逗号分隔）
      const selectedIds = Array.from(selectedNodes).join(',');
      e.dataTransfer.setData('text/plain', selectedIds);
      e.dataTransfer.effectAllowed = 'move';

      // 设置拖拽提示
      if (selectedNodes.size > 1) {
        e.dataTransfer.setData('text/html', `<div>移动 ${selectedNodes.size} 个项目</div>`);
      }
    });

    row.addEventListener('dragend', () => {
      stopAutoScroll();
    });

    // 拖拽目标：文件夹可以接收，文件也可以接收（会移动到其父目录）
    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      // 处理自动滚动
      const container = document.getElementById('tree');
      if (container) {
        handleAutoScroll(e, container);
      }

      // 处理视觉反馈
      clearDragOverStyles();
      const position = getDropPosition(e, row, node);
      row.classList.add(`drag-over-${position}`);
    });

    row.addEventListener('dragleave', () => {
      row.classList.remove('drag-over-before', 'drag-over-after', 'drag-over-inside');
    });

    row.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation(); // 阻止事件冒泡
      stopAutoScroll(); // 停止自动滚动
      clearDragOverStyles();

      const sourceData = e.dataTransfer.getData('text/plain');
      if (!sourceData) return;

      // 解析源节点ID（可能是多个，用逗号分隔）
      const sourceIds = sourceData.split(',').filter(id => id && id !== node.id);
      if (sourceIds.length === 0) return;

      const position = getDropPosition(e, row, node);
      let targetNode = node;

      // 如果是 before/after，目标应该是父节点（移动到父节点下，targetNode 的前后）
      // 如果是 inside，目标就是当前节点（如果是文件夹）

      // 移动所有选中的节点
      if (handlers.onMove) {
        sourceIds.forEach(sourceId => {
          handlers.onMove(sourceId, targetNode, position);
        });
      }

      // 清除选择
      clearSelection();
    });

    if (node.type === 'folder') {
      li.classList.add('collapsible');
      // 默认展开所有文件夹
      li.classList.add('expanded');
      expandedFolders.add(node.id);
      // 递归渲染子节点
      li.appendChild(buildTreeDom(node.id));
    }

    ul.appendChild(li);
  });
  return ul;
}

// 获取当前展开的文件夹ID
function getExpandedFolders() {
  const folders = new Set();
  document.querySelectorAll('.tree-item.folder.expanded').forEach(el => {
    folders.add(el.dataset.nodeId);
  });
  return folders;
}

function renderTree() {
  const container = document.getElementById('tree');
  if (!container) return;

  // 保存当前展开的文件夹状态
  if (expandedFolders.size === 0) {
    // 只在第一次渲染时从DOM获取
    expandedFolders = getExpandedFolders();
  }

  container.innerHTML = '';

  // 为根容器添加拖拽支持，允许拖拽到根目录
  // 点击空白区域清除选择
  container.addEventListener('click', (e) => {
    if (e.target === container || e.target.classList.contains('tree-root')) {
      clearSelection();
      document.querySelectorAll('.tree-row.active').forEach(x => x.classList.remove('active'));
    }
  });

  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    // 处理自动滚动
    handleAutoScroll(e, container);
  });

  container.addEventListener('dragleave', (e) => {
    // 当拖拽离开容器时停止自动滚动
    if (e.target === container) {
      stopAutoScroll();
    }
  });

  container.addEventListener('drop', (e) => {
    // 停止自动滚动
    stopAutoScroll();

    // 只在空白区域或根列表上响应
    if (e.target === container || e.target.classList.contains('tree-root')) {
      e.preventDefault();
      const sourceData = e.dataTransfer.getData('text/plain');
      if (!sourceData) return;

      // 解析源节点ID（可能是多个，用逗号分隔）
      const sourceIds = sourceData.split(',').filter(id => id);
      if (sourceIds.length === 0) return;

      // 移动所有选中的节点到根目录
      if (handlers.onMove) {
        sourceIds.forEach(sourceId => {
          handlers.onMove(sourceId, null);
        });
      }

      // 清除选择
      clearSelection();
    }
  });

  container.addEventListener('dragend', () => {
    // 拖拽结束时停止自动滚动
    stopAutoScroll();
  });

  // 根是 parentId === null 的集合，渲染为一级
  const roots = vfs.listChildren(null);
  const rootUl = document.createElement('ul');
  rootUl.className = 'tree-root';
  roots.forEach((rootNode) => {
    const li = document.createElement('li');
    li.className = 'tree-item ' + (rootNode.type === 'folder' ? 'folder' : 'file');
    li.dataset.nodeId = rootNode.id;
    const row = document.createElement('div');
    row.className = 'tree-row';
    row.draggable = true;
    const icon = document.createElement('span');
    icon.className = 'tree-icon';
    icon.textContent = rootNode.type === 'folder' ? '📓' : '📄';
    const label = document.createElement('span');
    label.className = 'tree-label';
    label.textContent = rootNode.name;

    row.appendChild(icon);
    row.appendChild(label);
    row.appendChild(createLockIcon(rootNode));
    li.appendChild(row);

    row.addEventListener('click', (e) => {
      // 取消任何正在进行的重命名
      cancelCurrentRename();

      // 处理多选
      handleNodeClick(rootNode, e, row);

      // 文件夹展开/折叠逻辑（仅在非多选模式下）
      if (rootNode.type === 'folder' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        const wasExpanded = li.classList.contains('expanded');
        li.classList.toggle('expanded');
        const existing = li.querySelector(':scope > ul.tree-level');

        if (li.classList.contains('expanded')) {
          if (existing) existing.remove();
          li.appendChild(buildTreeDom(rootNode.id));
          if (!wasExpanded) {
            expandedFolders.add(rootNode.id);
          }
        } else {
          if (existing) existing.remove();
          expandedFolders.delete(rootNode.id);
        }
      }
    });

    row.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (handlers.onContext) handlers.onContext(rootNode, e);
    });

    // 根节点拖拽：源始终可拖
    row.addEventListener('dragstart', (e) => {
      // 如果拖拽的节点不在选中列表中，清除选择并只选中当前节点
      if (!selectedNodes.has(rootNode.id)) {
        clearSelection();
        selectedNodes.add(rootNode.id);
        row.classList.add('selected');
      }

      // 传递所有选中的节点ID
      const selectedIds = Array.from(selectedNodes).join(',');
      e.dataTransfer.setData('text/plain', selectedIds);
      e.dataTransfer.effectAllowed = 'move';

      // 设置拖拽提示
      if (selectedNodes.size > 1) {
        e.dataTransfer.setData('text/html', `<div>移动 ${selectedNodes.size} 个项目</div>`);
      }
    });

    row.addEventListener('dragend', () => {
      stopAutoScroll();
    });

    // 拖拽目标：文件夹可以接收，文件也可以接收（会移动到根目录）
    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      // 处理自动滚动
      handleAutoScroll(e, container);

      // 处理视觉反馈
      clearDragOverStyles();
      const position = getDropPosition(e, row, rootNode);
      row.classList.add(`drag-over-${position}`);
    });

    row.addEventListener('dragleave', () => {
      row.classList.remove('drag-over-before', 'drag-over-after', 'drag-over-inside');
    });

    row.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation(); // 阻止事件冒泡到容器
      stopAutoScroll(); // 停止自动滚动
      clearDragOverStyles();

      const sourceData = e.dataTransfer.getData('text/plain');
      if (!sourceData) return;

      // 解析源节点ID（可能是多个，用逗号分隔）
      const sourceIds = sourceData.split(',').filter(id => id && id !== rootNode.id);
      if (sourceIds.length === 0) return;

      const position = getDropPosition(e, row, rootNode);
      const targetNode = rootNode;

      // 移动所有选中的节点
      if (handlers.onMove) {
        sourceIds.forEach(sourceId => {
          handlers.onMove(sourceId, targetNode, position);
        });
      }

      // 清除选择
      clearSelection();
    });

    if (rootNode.type === 'folder') {
      li.classList.add('collapsible');
      // 默认展开根文件夹
      li.classList.add('expanded');
      expandedFolders.add(rootNode.id);
      // 递归渲染子节点
      li.appendChild(buildTreeDom(rootNode.id));
    }

    rootUl.appendChild(li);
  });
  container.appendChild(rootUl);
}

// 保存当前正在重命名的节点ID和取消函数
let currentRename = {
  nodeId: null,
  cancel: null
};

// 取消当前正在进行的重命名操作
function cancelCurrentRename() {
  if (currentRename.cancel) {
    currentRename.cancel();
    currentRename = { nodeId: null, cancel: null };
  }
}

function startInlineRename(nodeId) {
  // 取消任何正在进行的重命名
  if (currentRename.nodeId && currentRename.nodeId !== nodeId) {
    cancelCurrentRename();
  }

  const li = document.querySelector(`.tree-item[data-node-id="${nodeId}"]`);
  if (!li) return;
  const label = li.querySelector('.tree-label');
  if (!label) return;
  const node = vfs.getNodeById(nodeId);
  if (!node) return;

  // 防重复
  if (li.querySelector('input.tree-rename')) return;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'tree-rename';
  input.value = node.name || '';
  // 计算合适的宽度：基于标签宽度，增加一些padding空间
  const labelWidth = label.offsetWidth || 100;
  input.style.width = Math.max(100, labelWidth + 20) + 'px';

  // 替换 label
  label.style.display = 'none';
  label.after(input);

  // 确保输入框可交互
  input.style.position = 'relative';
  input.style.zIndex = '1000';
  input.focus();

  // 智能选择：如果是文件（有扩展名），只选中文件名部分，不包括扩展名
  const lastDotIndex = input.value.lastIndexOf('.');
  if (node.type === 'file' && lastDotIndex > 0) {
    // 只选中扩展名之前的部分
    input.setSelectionRange(0, lastDotIndex);
  } else {
    // 文件夹或没有扩展名的文件，选中全部
    input.select();
  }

  let committed = false;
  const commit = () => {
    if (committed) return;
    committed = true;
    const newName = (input.value || '').trim();
    input.removeEventListener('keydown', onKey);
    input.removeEventListener('blur', onBlur);
    input.parentNode && input.parentNode.removeChild(input);
    label.style.display = '';
    if (newName && newName !== node.name) {
      if (handlers.onInlineRenameCommit) handlers.onInlineRenameCommit(node, newName);
    }
  };
  const cancel = () => {
    if (committed) return;
    committed = true;
    input.removeEventListener('keydown', onKey);
    input.removeEventListener('blur', onBlur);
    input.parentNode && input.parentNode.removeChild(input);
    label.style.display = '';
    // 清除当前重命名状态
    if (currentRename.nodeId === nodeId) {
      currentRename = { nodeId: null, cancel: null };
    }
  };
  const onKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    }
  };
  const onBlur = () => commit();
  // 保存当前重命名状态
  currentRename = {
    nodeId: nodeId,
    cancel: cancel
  };

  input.addEventListener('keydown', onKey);
  input.addEventListener('blur', onBlur);
}

/**
 * 应用搜索过滤(使用CSS控制可见性)
 * @param {Array} matchedNodes - 匹配的节点数组
 */
function applySearchFilter(matchedNodes) {
  const matchedIds = new Set(matchedNodes.map(n => n.id));
  const parentIds = new Set();

  // 收集所有匹配节点的父路径
  matchedNodes.forEach(node => {
    const path = vfs.getNodePath(node.id);
    path.forEach(n => parentIds.add(n.id));
  });

  // 遍历所有树节点,控制可见性
  document.querySelectorAll('.tree-item').forEach(item => {
    const nodeId = item.dataset.nodeId;
    if (matchedIds.has(nodeId) || parentIds.has(nodeId)) {
      item.style.display = ''; // 显示
      // 自动展开包含匹配结果的文件夹
      if (parentIds.has(nodeId) && item.classList.contains('folder')) {
        item.classList.add('expanded');
        // 确保子树已渲染
        const existing = item.querySelector(':scope > ul.tree-level');
        if (!existing) {
          const node = vfs.getNodeById(nodeId);
          if (node) {
            item.appendChild(buildTreeDom(node.id));
          }
        }
      }
    } else {
      item.style.display = 'none'; // 隐藏
    }
  });

  // 标记搜索模式
  const container = document.getElementById('tree');
  if (container) container.dataset.searchMode = 'true';
}

/**
 * 清除搜索过滤
 */
function clearSearchFilter() {
  // 恢复所有节点可见性
  document.querySelectorAll('.tree-item').forEach(item => {
    item.style.display = '';
  });

  // 移除搜索模式标记
  const container = document.getElementById('tree');
  if (container) delete container.dataset.searchMode;
}

export {
  setHandlers,
  renderTree,
  startInlineRename,
  buildTreeDom,
  applySearchFilter,
  clearSearchFilter,
};
