import { createMarkdownRenderer } from '../../utils/markdown-renderer.js';

import state from '../state.js';
import { t } from '../i18n.js';

const styleUrl = new URL('./preview.css', import.meta.url);
let styleInjected = false;

function ensureStyleInjected() {
  if (styleInjected) return;
  const styleId = 'preview-style';
  if (document.getElementById(styleId)) {
    styleInjected = true;
    return;
  }
  const link = document.createElement('link');
  link.id = styleId;
  link.rel = 'stylesheet';
  link.href = styleUrl.href;
  document.head.appendChild(link);
  styleInjected = true;
}

function toFileUrl(absolutePath) {
  if (!absolutePath) return null;
  return `file://${absolutePath.replace(/\\/g, '/')}`;
}

function resolveImageSrc(src) {
  if (!src || src.startsWith('file://') || src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
    return null;
  }

  const electronAPI = window.electronAPI;
  const pathAPI = electronAPI?.path;
  if (!pathAPI || !state.workspaceRoot) return null;

  const trimmedSrc = src.trim();
  const databaseRoot = pathAPI.join(state.workspaceRoot, 'Database');
  const objectsDir = pathAPI.join(databaseRoot, 'objects');

  if (trimmedSrc.startsWith('../') || trimmedSrc.startsWith('./')) {
    const absolutePath = pathAPI.resolve(objectsDir, trimmedSrc);
    return toFileUrl(absolutePath);
  }

  if (trimmedSrc.startsWith('/Database/Images/')) {
    const withoutLeadingSlash = trimmedSrc.replace(/^\//, '');
    const absolutePath = pathAPI.join(state.workspaceRoot, withoutLeadingSlash);
    return toFileUrl(absolutePath);
  }

  if (trimmedSrc.startsWith('Database/Images/')) {
    const absolutePath = pathAPI.join(state.workspaceRoot, trimmedSrc);
    return toFileUrl(absolutePath);
  }

  return null;
}

function wrapCodeBlocks(html) {
  if (!html) return html;
  
  return html.replace(/<pre([^>]*)><code>([\s\S]*?)<\/code><\/pre>/g, (match, preAttrs, code) => {
    return `<div class="code-block-wrapper">
      <button class="code-copy-btn" title="${t('preview.copyCode')}"></button>
      <pre${preAttrs}><code>${code}</code></pre>
    </div>`;
  });
}

function attachCopyHandlers(previewElement) {
  const copyButtons = previewElement.querySelectorAll('.code-copy-btn');
  
  const copyIcon = `<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"></path><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"></path></svg>`;
  const checkIcon = `<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"></path></svg>`;
  
  copyButtons.forEach(button => {
    button.innerHTML = copyIcon;
    
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const wrapper = button.closest('.code-block-wrapper');
      const codeElement = wrapper.querySelector('code');
      const codeText = codeElement.textContent;
      
      try {
        await navigator.clipboard.writeText(codeText);
        
        button.innerHTML = checkIcon;
        button.classList.add('copied');
        
        setTimeout(() => {
          button.innerHTML = copyIcon;
          button.classList.remove('copied');
        }, 2000);
      } catch (err) {
        console.error('Copy Error:', err);
      }
    });
  });
}

function resolveImagePaths(html) {
  if (!html) return html;
  return html.replace(/<img\s+[^>]*src="([^"]+)"[^>]*>/gi, (match, src) => {
    const resolved = resolveImageSrc(src);
    if (!resolved) return match;
    return match.replace(src, resolved);
  });
}

const md = createMarkdownRenderer();

function renderPreview() {

  ensureStyleInjected();

  if (!state.editor) return;

  const previewElement = document.getElementById('preview');
  if (!previewElement) return;

  try {
    const rawMarkdown = state.editor.getValue();
    if (md) {
      let html = md.render(rawMarkdown);
      html = resolveImagePaths(html);
      html = wrapCodeBlocks(html);
      previewElement.innerHTML = html;
      
      // 添加复制按钮事件监听
      attachCopyHandlers(previewElement);
    } else {
      previewElement.textContent = rawMarkdown;
    }
  } catch (error) {
    previewElement.textContent = state.editor.getValue();
    console.error('renderPreview failed:', error);
  }
}

function initPreview() {
  ensureStyleInjected();
  renderPreview();
}

export {
  initPreview,
  renderPreview,
};
