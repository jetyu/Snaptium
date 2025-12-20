import { createMarkdownRenderer } from '../../utils/markdown-renderer.js';

import state from '../state.js';

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
      const html = md.render(rawMarkdown);
      previewElement.innerHTML = resolveImagePaths(html);
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
