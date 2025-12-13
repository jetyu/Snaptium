import i18n, { t } from '../i18n.js';
import state from '../state.js';
import * as vfs from '../workspace/vfs.js';
import { renderTree } from '../workspace/tree.js';

const electronAPI = window.electronAPI;

if (!electronAPI) {
  throw new Error('electronAPI 未初始化，无法在渲染进程访问受信任的 Node API');
}

const {
  ipcRenderer,
  fs: electronFs,
  path: electronPath,
} = electronAPI;

const templateUrl = new URL('./trash.html', import.meta.url);
const styleUrl = new URL('./trash.css', import.meta.url);

let modalElement = null;
let isInitialized = false;
let keydownBound = false;

function resolveFilePath(url) {
  let pathname = decodeURIComponent(url.pathname);
  if (/^\/([A-Za-z]:)/.test(pathname)) {
    pathname = pathname.slice(1);
  }
  return electronPath.normalize(pathname);
}

function ensureStyleInjected() {
  const styleId = 'trash-modal-style';
  if (document.getElementById(styleId)) {
    return;
  }
  const link = document.createElement('link');
  link.id = styleId;
  link.rel = 'stylesheet';
  link.href = styleUrl.href;
  document.head.appendChild(link);
}

function bindModalEvents(modal) {
  const closeBtn = modal.querySelector('#trash-close');
  if (closeBtn) {
    const closeHandler = () => closeTrashDialog();
    closeBtn.addEventListener('click', closeHandler);
    closeBtn.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        closeTrashDialog();
      }
    });
  }

  const emptyBtn = modal.querySelector('#empty-trash-btn');
  if (emptyBtn) {
    emptyBtn.addEventListener('click', async () => {
      if (!confirm(t('trash.emptyConfirm'))) return;
      try {
        const removed = vfs.emptyTrash();
        await loadTrashItems();
        renderTree();
        ipcRenderer.send('trash-updated', { removed });
      } catch (error) {
        console.error(t('trash.emptyFailed') + ':', error);
      }
    });
  }

  if (!keydownBound) {
    document.addEventListener('keydown', handleKeydown, true);
    keydownBound = true;
  }
}

function handleKeydown(event) {
  if (event.key === 'Escape' && modalElement && !modalElement.classList.contains('hidden')) {
    closeTrashDialog();
  }
}

async function ensureModalExists() {
  if (modalElement && document.body.contains(modalElement)) {
    return modalElement;
  }

  const existing = document.getElementById('trash-modal');
  if (existing) {
    modalElement = existing;
    ensureStyleInjected();
    bindModalEvents(modalElement);
    return modalElement;
  }

  if (document.readyState === 'loading') {
    await new Promise((resolve) => {
      document.addEventListener('DOMContentLoaded', resolve, { once: true });
    });
  }

  ensureStyleInjected();

  const templatePath = resolveFilePath(templateUrl);
  try {
    const htmlContent = electronFs.readFileSync(templatePath, 'utf8');
    if (!document.body) {
      console.warn(t('trash.bodyNotExist'));
      return null;
    }

    const container = document.createElement('div');
    container.innerHTML = htmlContent.trim();
    const createdModal = container.firstElementChild;
    if (!createdModal) {
      console.warn(t('trash.templateEmpty'));
      return null;
    }

    document.body.appendChild(createdModal);
    modalElement = createdModal;

    if (i18n && typeof i18n.applyI18n === 'function') {
      i18n.applyI18n(modalElement);
    }

    bindModalEvents(modalElement);
    return modalElement;
  } catch (error) {
    console.error(t('trash.loadTemplateFailed') + ':', error);
    return null;
  }
}

function bindGlobalEvents() {
  ipcRenderer?.on('open-trash', () => {
    showTrashDialog();
  });

  ipcRenderer?.on('trash-updated', () => {
    if (modalElement && !modalElement.classList.contains('hidden')) {
      loadTrashItems();
    }
  });
}

function ensureWorkspaceTrashDirectory() {
  const workspaceRoot = vfs.getDefaultWorkspaceRoot();
  const trashPath = electronPath.join(workspaceRoot, 'Database', 'trash');
  if (!electronFs.existsSync(trashPath)) {
    electronFs.mkdirSync(trashPath, { recursive: true });
  }
}

async function loadTrashItems() {
  try {
    const tbody = document.getElementById('trash-list');
    if (!tbody) return;

    tbody.innerHTML = '';

    // 只显示根节点（没有被删除的父节点的节点）
    const trashedNodes = [];
    for (const [id, node] of state.nodes) {
      if (node.trashed) {
        // 检查父节点是否也被删除
        const parent = node.parentId ? state.nodes.get(node.parentId) : null;
        const isRootTrashedNode = !parent || !parent.trashed;

        if (isRootTrashedNode) {
          // 统计子项数量
          let childCount = 0;
          const countChildren = (nodeId) => {
            for (const [childId, childNode] of state.nodes) {
              if (childNode.parentId === nodeId && childNode.trashed) {
                childCount++;
                if (childNode.type === 'folder') {
                  countChildren(childId);
                }
              }
            }
          };
          countChildren(id);

          trashedNodes.push({
            id,
            name: node.name,
            type: node.type,
            trashedAt: node.trashedAt || new Date().toISOString(),
            fileName: node.fileName || '',
            parentId: node.parentId,
            childCount: childCount,
          });
        }
      }
    }

    if (trashedNodes.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML = '<td colspan="3" class="trash-modal__empty" data-i18n="trash.emptyState"></td>';
      tbody.appendChild(row);
      if (i18n && typeof i18n.applyI18n === 'function') {
        i18n.applyI18n(tbody);
      }
      return;
    }

    trashedNodes.sort((a, b) => new Date(b.trashedAt) - new Date(a.trashedAt));

    trashedNodes.forEach((item) => {
      const row = document.createElement('tr');
      const fileName = item.type === 'file' ? (item.fileName || `${item.name}.md`) : '-';

      // 显示名称，如果是文件夹且有子项，显示子项数量
      let displayName = item.name;
      if (item.type === 'folder' && item.childCount > 0) {
        displayName = `${item.name} (${item.childCount} ${t('trash.items')})`;
      }

      row.innerHTML = `
        <td>${displayName}</td>
        <td>${fileName}</td>
        <td class="trash-modal__actions">
          <button class="trash-modal__btn trash-modal__btn--restore" data-id="${item.id}" data-i18n="trash.restore">恢复</button>
          <button class="trash-modal__btn trash-modal__btn--delete" data-id="${item.id}" data-i18n="trash.delete">永久删除</button>
        </td>
      `;
      tbody.appendChild(row);
    });

    tbody.querySelectorAll('.trash-modal__btn--restore').forEach((btn) => {
      btn.addEventListener('click', async (event) => {
        event.stopPropagation();
        const id = btn.getAttribute('data-id');
        if (id && confirm(t('trash.restoreConfirm'))) {
          vfs.restoreNode(id);
          await loadTrashItems();
          renderTree();
          ipcRenderer.send('trash-updated');
        }
      });
    });

    tbody.querySelectorAll('.trash-modal__btn--delete').forEach((btn) => {
      btn.addEventListener('click', async (event) => {
        event.stopPropagation();
        const id = btn.getAttribute('data-id');
        if (id && confirm(t('trash.permanentDeleteConfirm'))) {
          vfs.deleteNode(id, true);
          await loadTrashItems();
          renderTree();
          ipcRenderer.send('trash-updated');
        }
      });
    });

    if (i18n && typeof i18n.applyI18n === 'function') {
      i18n.applyI18n(tbody);
    }
  } catch (error) {
    console.error(t('trash.loadFailed') + ':', error);
  }
}

async function showTrashDialog() {
  try {
    const modal = await ensureModalExists();
    if (!modal) {
      console.error(t('trash.cannotCreateDialog'));
      return;
    }

    if (i18n?.init) {
      await i18n.init();
      if (i18n.applyI18n) {
        i18n.applyI18n(modal);
      }
    }

    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');



    await loadTrashItems();
  } catch (error) {
    console.error(t('trash.showDialogError') + ':', error);
  }
}

function closeTrashDialog() {
  if (!modalElement) return;
  modalElement.classList.add('hidden');
  modalElement.setAttribute('aria-hidden', 'true');
}

function initTrash() {
  if (isInitialized) {
    return;
  }

  ensureWorkspaceTrashDirectory();
  bindGlobalEvents();
  isInitialized = true;
}

export {
  initTrash,
  showTrashDialog,
  closeTrashDialog,
  loadTrashItems,
};
