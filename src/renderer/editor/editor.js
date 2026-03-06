import state from '../state.js';
import { getAIAssistant } from '../ai-service/ai-assistant.js';
import { renderPreview } from '../preview/preview.js';
import { getNodeById } from '../workspace/vfs.js';
import { t } from '../i18n.js';

export function initializeEditor() {
  const editorElement = document.getElementById('editor');
  if (editorElement && !state.editor) {
    try {
      state.editor = CodeMirror.fromTextArea(editorElement, {
        mode: 'markdown',
        lineNumbers: true,
        lineWrapping: true,
        theme: 'default',
        inputStyle: 'contenteditable',
        autofocus: true,
        extraKeys: {
          'Ctrl-S': function () {
            // 触发保存逻辑
            window.dispatchEvent(new CustomEvent('notewizard-save'));
          },
          'Tab': function (cm) {
            return handleTabKey(cm);
          },
          'Esc': function (cm) {
            return handleEscKey(cm);
          },
          'Ctrl-/': function () {
            hideAISuggestion();
          }
        },
      });

      const aiAssistant = getAIAssistant();
      setupEditorEventListeners(state.editor, aiAssistant);

      setTimeout(() => {
        if (state.editor) {
          state.editor.refresh();
          state.editor.focus();
          window.dispatchEvent(new Event('editor-ready'));
        }
      }, 100);

      registerImagePasteHandler(state.editor);

      return true;
    } catch (error) {
      console.error('Failed to initialize editor:', error);
      return false;
    }
  }
  return false;
}

function setupEditorEventListeners(editor, aiAssistant) {
  editor.on('change', function (cm, change) {
    const content = cm.getValue();
    const event = new CustomEvent('editor-content-changed', {
      detail: { content, change }
    });
    window.dispatchEvent(event);
  });

  editor.on('cursorActivity', function (cm) {
    const cursor = cm.getCursor();
    const event = new CustomEvent('editor-cursor-changed', {
      detail: { cursor }
    });
    window.dispatchEvent(event);
  });

  // Scroll Synchronization
  const scrollElement = editor.getScrollerElement();
  const previewContainer = document.getElementById('preview-container');

  if (scrollElement && previewContainer) {
    let isSyncingLeft = false; // Editor -> Preview
    let isSyncingRight = false; // Preview -> Editor
    let syncTimeout;

    // Cache for mapping source lines to preview elements
    let lineElementMap = [];

    const clearSync = () => {
      clearTimeout(syncTimeout);
      syncTimeout = setTimeout(() => {
        isSyncingLeft = false;
        isSyncingRight = false;
      }, 100);
    };

    // Debounce function to prevent excessive cache updates
    const debounce = (func, wait) => {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    };

    // Build the cache mapping source lines to their DOM elements and offsets
    const updateScrollCache = () => {
      const elements = Array.from(previewContainer.querySelectorAll('[data-source-line]'));
      lineElementMap = elements.map(el => {
        const line = parseInt(el.getAttribute('data-source-line'), 10);
        return {
          line: isNaN(line) ? -1 : line,
          element: el,
          offsetTop: el.offsetTop
        };
      }).filter(item => item.line >= 0)
        .sort((a, b) => a.line - b.line);
    };

    // Initial cache build
    updateScrollCache();

    // Observe changes in the preview container to update cache
    const observer = new MutationObserver(debounce(() => {
      updateScrollCache();
    }, 100));

    observer.observe(previewContainer, {
      childList: true,
      subtree: true,
      attributes: false, // data-source-line shouldn't change on existing elements usually
      characterData: false
    });

    // Also update cache on window resize as offsetTop might change
    window.addEventListener('resize', debounce(() => {
      updateScrollCache();
    }, 100));

    // Sync: Editor -> Preview
    editor.on('scroll', () => {
      if (isSyncingRight || lineElementMap.length === 0) return;

      isSyncingLeft = true;
      clearSync();

      const scrollInfo = editor.getScrollInfo();

      if (scrollInfo.top <= 0) {
        previewContainer.scrollTop = 0;
        return;
      }

      if (scrollInfo.top + scrollInfo.clientHeight >= scrollInfo.height - 1) {
        previewContainer.scrollTop = previewContainer.scrollHeight - previewContainer.clientHeight;
        return;
      }

      const topVisibleLine = editor.lineAtHeight(scrollInfo.top, 'local');

      // Find the two surrounding mapping points in the map
      let upper = null;
      let lower = null;

      for (let i = 0; i < lineElementMap.length; i++) {
        if (lineElementMap[i].line <= topVisibleLine) {
          upper = lineElementMap[i];
        } else {
          lower = lineElementMap[i];
          break;
        }
      }

      if (!upper) {
        // Above the first mapped element
        previewContainer.scrollTop = 0;
      } else if (!lower) {
        // Below the last mapped element
        const lastEl = lineElementMap[lineElementMap.length - 1];
        const lastOffset = lastEl.element.offsetTop;
        previewContainer.scrollTop = lastOffset;
      } else {
        // Intermediate: apply linear interpolation
        const lineDiff = lower.line - upper.line;
        const offsetDiff = lower.offsetTop - upper.offsetTop;
        const lineProgress = (topVisibleLine - upper.line) / lineDiff;

        const interpolatedOffset = upper.offsetTop + (lineProgress * offsetDiff);
        previewContainer.scrollTop = interpolatedOffset;
      }
    });

    // sync: Preview -> Editor (Linear Interpolation)
    previewContainer.addEventListener('scroll', () => {
      if (isSyncingLeft || lineElementMap.length === 0) return;

      isSyncingRight = true;
      clearSync();

      const scrollTop = previewContainer.scrollTop;

      if (scrollTop <= 0) {
        editor.scrollTo(null, 0);
        return;
      }

      if (scrollTop + previewContainer.clientHeight >= previewContainer.scrollHeight - 1) {
        editor.scrollTo(null, editor.getScrollInfo().height);
        return;
      }

      let upper = null;
      let lower = null;

      for (let i = 0; i < lineElementMap.length; i++) {
        if (lineElementMap[i].offsetTop <= scrollTop) {
          upper = lineElementMap[i];
        } else {
          lower = lineElementMap[i];
          break;
        }
      }

      if (!upper) {
        editor.scrollTo(null, 0);
      } else if (!lower) {
        const lastEl = lineElementMap[lineElementMap.length - 1];
        const coords = editor.charCoords({ line: lastEl.line, ch: 0 }, 'local');
        editor.scrollTo(null, coords.top);
      } else {
        const offsetDiff = lower.offsetTop - upper.offsetTop;
        const lineDiff = lower.line - upper.line;
        const offsetProgress = (scrollTop - upper.offsetTop) / offsetDiff;

        const interpolatedLine = upper.line + (offsetProgress * lineDiff);
        const coords = editor.charCoords({ line: Math.floor(interpolatedLine), ch: 0 }, 'local');

        // Refine with fractional line height if needed, but floor is usually fine for CM5
        editor.scrollTo(null, coords.top);
      }
    });
  }
}

function handleTabKey(cm) {
  const aiAssistant = getAIAssistant();

  if (aiAssistant && aiAssistant.currentSuggestion) {
    aiAssistant.applySuggestion();
    return false;
  }

  const spaces = Array(3).fill(' ').join('');
  cm.replaceSelection(spaces);
  return false;
}

function handleEscKey(cm) {
  const aiAssistant = getAIAssistant();
  if (aiAssistant && aiAssistant.currentSuggestion) {
    aiAssistant.hideSuggestion();
    return false;
  }

  return CodeMirror.Pass;
}

function hideAISuggestion() {
  const aiAssistant = getAIAssistant();
  if (aiAssistant) {
    aiAssistant.hideSuggestion();
  }
}

function registerImagePasteHandler(editor) {
  if (!editor || typeof editor.getWrapperElement !== 'function') return;
  const wrapper = editor.getWrapperElement();
  if (!wrapper) return;

  const processImageFiles = async (files) => {
    const imageFiles = files.filter((file) => file.type && file.type.startsWith('image/'));
    if (!imageFiles.length) return;

    const { electronAPI } = window;
    if (!electronAPI || !electronAPI.images || typeof electronAPI.images.saveImageFromPaste !== 'function') {
      console.warn('Missing electronAPI interface for saving images');
      return;
    }

    if (!state.workspaceRoot) {
      console.warn('workspaceRoot not initialized, cannot save pasted images');
      return;
    }

    const currentNodeId = state.currentNodeId;
    const currentNode = currentNodeId ? getNodeById(currentNodeId) : null;
    const contentId = currentNode?.contentId;
    if (!contentId) {
      if (electronAPI.dialog && typeof electronAPI.dialog.showMessageBox === 'function') {
        electronAPI.dialog.showMessageBox({
          type: 'warning',
          title: '无法保存图片',
          message: '请选择一个已有内容的笔记后再粘贴或拖拽图片。'
        });
      }
      return;
    }

    for (const file of imageFiles) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const bytes = Array.from(new Uint8Array(arrayBuffer));
        const result = await electronAPI.images.saveImageFromPaste({
          bytes,
          originalName: file.name || '',
          mimeType: file.type || 'image/png',
          workspaceRoot: state.workspaceRoot,
          contentId,
          noteName: currentNode?.name || ''
        });

        if (!result || !result.success || !result.markdownPath) {
          const errorMessage = result?.error || 'Failed to save image';
          console.error(errorMessage);
          if (electronAPI.dialog && typeof electronAPI.dialog.showMessageBox === 'function') {
            electronAPI.dialog.showMessageBox({
              type: 'error',
              title: '图片保存失败',
              message: errorMessage,
            });
          }
          continue;
        }

        insertImageMarkdown(editor, result.markdownPath);
      } catch (error) {
        console.error('Failed to process image:', error);
        if (electronAPI.dialog && typeof electronAPI.dialog.showMessageBox === 'function') {
          electronAPI.dialog.showMessageBox({
            type: 'error',
            title: '图片保存失败',
            message: error?.message || '无法保存图片',
          });
        }
      }
    }
  };

  const handlePaste = async (event) => {
    const clipboardData = event?.clipboardData;
    if (!clipboardData) return;

    const files = Array.from(clipboardData.files || []);
    if (!files.length) return;

    event.preventDefault();
    await processImageFiles(files);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleDrop = async (event) => {
    const dataTransfer = event?.dataTransfer;
    if (!dataTransfer) return;

    const files = Array.from(dataTransfer.files || []);
    if (!files.length) return;

    event.preventDefault();
    await processImageFiles(files);
  };

  wrapper.addEventListener('paste', handlePaste);
  wrapper.addEventListener('dragover', handleDragOver);
  wrapper.addEventListener('drop', handleDrop);

  // 右键菜单
  registerContextMenu(editor);
}

function insertImageMarkdown(editor, markdownPath) {
  if (!editor || !markdownPath) return;
  const doc = editor.getDoc();
  if (!doc) return;

  const selection = doc.getSelection();
  const imageMarkdown = `![](${markdownPath})`;
  const contentToInsert = selection ? imageMarkdown : `\n${imageMarkdown}\n`;

  doc.replaceSelection(contentToInsert, 'around');
  editor.focus();
  renderPreview();
}

function registerContextMenu(editor) {
  if (!editor || typeof editor.getWrapperElement !== 'function') return;
  const wrapper = editor.getWrapperElement();
  if (!wrapper) return;

  wrapper.addEventListener('contextmenu', (event) => {
    event.preventDefault();

    const { electronAPI } = window;
    if (!electronAPI || !electronAPI.contextMenu) {
      console.warn('Missing electronAPI.contextMenu interface');
      return;
    }

    const doc = editor.getDoc();
    const hasSelection = doc.getSelection().length > 0;

    // 检查剪贴板是否有内容
    const canPaste = navigator.clipboard && typeof navigator.clipboard.readText === 'function';

    const menuItems = [
      {
        label: t('contextMenu.copy'),
        action: 'copy',
        enabled: hasSelection
      },
      {
        label: t('contextMenu.cut'),
        action: 'cut',
        enabled: hasSelection
      },
      {
        label: t('contextMenu.paste'),
        action: 'paste',
        enabled: canPaste
      }
    ];

    electronAPI.contextMenu.show(menuItems, (action) => {
      switch (action) {
        case 'copy':
          if (hasSelection) {
            const selectedText = doc.getSelection();
            navigator.clipboard.writeText(selectedText).catch(err => {
              console.error('Failed to copy:', err);
            });
          }
          break;

        case 'cut':
          if (hasSelection) {
            const selectedText = doc.getSelection();
            navigator.clipboard.writeText(selectedText).then(() => {
              doc.replaceSelection('');
            }).catch(err => {
              console.error('Failed to cut:', err);
            });
          }
          break;

        case 'paste':
          navigator.clipboard.readText().then(text => {
            if (text) {
              doc.replaceSelection(text);
            }
          }).catch(err => {
            console.error('Failed to paste:', err);
          });
          break;
      }
    });
  });
}

export function onDomReadyInitEditor() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeEditor);
  } else {
    initializeEditor();
  }
}
