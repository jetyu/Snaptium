import state from '../state.js';
import { getAIAssistant } from '../ai-service/ai-assistant.js';
import { renderPreview } from '../preview/preview.js';
import { getNodeById } from '../workspace/vfs.js';

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
          },
          'Tab': function(cm) {
            return handleTabKey(cm);
          },
          'Esc': function(cm) {
            return handleEscKey(cm);
          },
          'Ctrl-/': function() {
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
  editor.on('change', function(cm, change) {
    const content = cm.getValue();
    const event = new CustomEvent('editor-content-changed', {
      detail: { content, change }
    });
    window.dispatchEvent(event);
  });

  editor.on('cursorActivity', function(cm) {
    const cursor = cm.getCursor();
    const event = new CustomEvent('editor-cursor-changed', {
      detail: { cursor }
    });
    window.dispatchEvent(event);
  });
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

export function onDomReadyInitEditor() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeEditor);
  } else {
    initializeEditor();
  }
}
