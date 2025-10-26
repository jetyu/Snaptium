import { onDomReadyInitEditor } from './renderer/editor/editor.js';
import { setupOutlineWhenReady } from './renderer/workspace/outline.js';
import { initializeFileWorkspace, setupEditorEvents } from './renderer/workspace/files.js';
import { setupToolbar } from './renderer/editor/toolbar.js';
import i18n, { initI18n, applyI18n } from './renderer/i18n.js';
import { initPreferences } from './renderer/preferences/index.js';
import { initTrash } from './renderer/trash/trash.js';
import { initPreview } from './renderer/preview/preview.js';
import { showInputDialog } from './renderer/preferences/ui/DialogController.js';

const { ipcRenderer } = window.electronAPI;

/**
 * 设置导出相关的 IPC 监听器
 */
function setupExportIPCListeners() {
  // 监听导出时请求恢复密钥的事件
  ipcRenderer.on('export:request-recovery-key', (event, { title, message }) => {
    showInputDialog({
      title,
      message,
      placeholder: i18n.t('labelRecoveryKey'),
      confirmText: i18n.t('btnConfirm'),
      cancelText: i18n.t('btnCancel'),
      onConfirm: (value) => {
        ipcRenderer.send('export:recovery-key-response', value);
      },
      onCancel: () => {
        ipcRenderer.send('export:recovery-key-response', null);
      }
    });
  });
}

function setupLeftPanelUI() {
  const leftPanel = document.getElementById('left-panel');
  const collapseBtn = document.getElementById('collapse-btn');
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  if (collapseBtn && leftPanel) {
    collapseBtn.setAttribute('aria-label', '折叠面板');
    collapseBtn.title = '折叠面板';
    
    collapseBtn.addEventListener('click', () => {
      leftPanel.classList.toggle('collapsed');
      const isCollapsed = leftPanel.classList.contains('collapsed');
      collapseBtn.setAttribute('aria-label', isCollapsed ? '展开面板' : '折叠面板');
      collapseBtn.title = isCollapsed ? '展开面板' : '折叠面板';
    });
  }

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;
      tabBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      tabContents.forEach((content) => {
        content.classList.remove('active');
        if (content.id === `${targetTab}-tab`) {
          content.classList.add('active');
        }
      });
    });
  });
}

function setupPreviewWidthPersistence() {
  const previewPanel = document.getElementById('preview-panel');
  if (!previewPanel) return;

  try {
    const storedWidth = localStorage.getItem('previewPanelWidth');
    if (storedWidth) {
      previewPanel.style.flex = '0 0 auto';
      previewPanel.style.width = storedWidth + 'px';
    }
  } catch {}
}

function setupPreviewLeftEdgeDrag() {
  const app = document.getElementById('app');
  const leftPanel = document.getElementById('left-panel');
  const editorPanel = document.getElementById('editor-panel');
  const previewPanel = document.getElementById('preview-panel');
  if (!app || !leftPanel || !editorPanel || !previewPanel) return;

  const EDGE_THRESHOLD = 8; // px
  let dragging = false;

  const getMinEditor = () => {
    const cssMin = parseInt(getComputedStyle(editorPanel).minWidth || '300', 10);
    return isNaN(cssMin) ? 300 : cssMin;
  };
  const getMinPreview = () => {
    const cssMin = parseInt(getComputedStyle(previewPanel).minWidth || '240', 10);
    return isNaN(cssMin) ? 240 : cssMin;
  };

  const updateCursor = (e) => {
    const rect = previewPanel.getBoundingClientRect();
    const nearLeftEdge = Math.abs(e.clientX - rect.left) <= EDGE_THRESHOLD;
    previewPanel.classList.toggle('edge-resize', nearLeftEdge);
  };

  const onMouseDown = (e) => {
    const rect = previewPanel.getBoundingClientRect();
    const nearLeftEdge = Math.abs(e.clientX - rect.left) <= EDGE_THRESHOLD;
    if (!nearLeftEdge) return;
    dragging = true;
    document.body.style.userSelect = 'none';
    e.preventDefault();
  };

  const onMouseMove = (e) => {
    if (!dragging) return;
    const appRect = app.getBoundingClientRect();
    const leftRect = leftPanel.getBoundingClientRect();
    const available = appRect.width - leftRect.width; // editor + preview total
    const minEditor = getMinEditor();
    const minPreview = getMinPreview();
    let previewWidth = appRect.right - e.clientX;
    const maxPreview = Math.max(minPreview, available - minEditor);
    previewWidth = Math.min(Math.max(previewWidth, minPreview), maxPreview);
    previewPanel.style.flex = '0 0 auto';
    previewPanel.style.width = previewWidth + 'px';
    try { localStorage.setItem('previewPanelWidth', String(Math.round(previewWidth))); } catch {}
  };

  const onMouseUp = () => {
    if (!dragging) return;
    dragging = false;
    document.body.style.userSelect = '';
  };

  previewPanel.addEventListener('mousemove', updateCursor);
  previewPanel.addEventListener('mouseleave', () => previewPanel.classList.remove('edge-resize'));
  previewPanel.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

function setupPreviewIpcHandlers() {
  const previewPanel = document.getElementById('preview-panel');
  const editorPanel = document.getElementById('editor-panel');
  if (!previewPanel || !editorPanel) return;

  const saveCurrentPreviewWidth = () => {
    const w = Math.round(previewPanel.getBoundingClientRect().width);
    if (w > 0) {
      try { localStorage.setItem('previewPanelWidth', String(w)); } catch {}
    }
  };

  const showPreview = () => {
    try {
      const saved = parseInt(localStorage.getItem('previewPanelWidth'), 10);
      if (!isNaN(saved) && saved > 0) {
        previewPanel.style.flex = '0 0 auto';
        previewPanel.style.width = saved + 'px';
      }
    } catch {}
    previewPanel.style.display = '';
    try { ipcRenderer.send('preview-state-changed', { visible: true }); } catch {}
  };

  const hidePreview = () => {
    saveCurrentPreviewWidth();
    previewPanel.style.display = 'none';
    editorPanel.style.flex = '1 1 auto';
    editorPanel.style.width = '';
    try { ipcRenderer.send('preview-state-changed', { visible: false }); } catch {}
  };

  ipcRenderer.removeAllListeners('preview-show');
  ipcRenderer.removeAllListeners('preview-hide');
  ipcRenderer.removeAllListeners('preview-toggle');
  ipcRenderer.on('preview-show', showPreview);
  ipcRenderer.on('preview-hide', hidePreview);
  ipcRenderer.on('preview-toggle', () => {
    const isHidden = previewPanel.style.display === 'none';
    if (isHidden) {
      showPreview();
    } else {
      hidePreview();
    }
  });
}

async function runAppInitialization() {
  setupLeftPanelUI();
  setupPreviewWidthPersistence();
  setupPreviewLeftEdgeDrag();
  setupPreviewIpcHandlers();
  
  await initI18n();
  
  onDomReadyInitEditor();
  await initializeFileWorkspace();
  setupEditorEvents();
  initPreview();
  setupToolbar();
  
  await initPreferences({ i18n });
  
  initTrash();
  setupOutlineWhenReady();
  setupExportIPCListeners();
  try {
    const visible = document.getElementById('preview-panel')?.style.display !== 'none';
    ipcRenderer.send('preview-state-changed', { visible });
  } catch {}
}

function bootstrap() {
  const start = () => {
    runAppInitialization().catch((err) => {
      console.error('Failed to initialize renderer process:', err);
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
}

bootstrap();
