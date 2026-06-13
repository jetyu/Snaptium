import DOMPurify from 'dompurify';
import MarkdownIt from 'markdown-it';
import markdownItKatex from 'markdown-it-katex';
import markdownItTaskLists from 'markdown-it-task-lists';
import {
  DEFAULT_TRUSTED_REMOTE_IMAGE_HOSTS,
  isTrustedRemoteImageUrl,
  normalizeTrustedRemoteImageHosts,
} from '@shared/preview-security.constants';
import { highlightMarkdownCode } from './markdownHighlight';

export interface MarkdownHeading {
  id: string;
  level: number;
  title: string;
  line: number;
}

export interface MarkdownRenderResult {
  html: string;
  headings: MarkdownHeading[];
}

export interface MarkdownRenderOptions {
  allowHtml?: boolean;
  allowInlineSvg?: boolean;
  remoteImageMode?: 'blocked' | 'trusted' | 'all';
  trustedRemoteImageHosts?: string[];
  blockedImageLabel?: string;
  copyCodeButtonLabel?: string;
  contentId?: string | null;
  workspaceRoot?: string | null;
}

interface MarkdownCompileEnv {
  headings: MarkdownHeading[];
  slugCounts: Map<string, number>;
}

interface MarkdownCodeBlockToken {
  content: string;
  info: string;
  map?: [number, number] | null;
}

const DATABASE_FOLDER = 'Database';
const OBJECTS_FOLDER = 'objects';
const WORKSPACE_RESOURCE_SCHEME = 'note-resource';

function slugifyHeading(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function extractInlineText(token: { content?: string; children?: Array<{ content?: string }> | null } | undefined) {
  if (!token) {
    return '';
  }

  if (Array.isArray(token.children) && token.children.length > 0) {
    return token.children
      .map((child) => child.content ?? '')
      .join('')
      .trim();
  }

  return String(token.content ?? '').trim();
}

function getUniqueHeadingId(env: MarkdownCompileEnv, baseSlug: string) {
  const safeSlug = baseSlug || 'section';
  const count = env.slugCounts.get(safeSlug) ?? 0;
  env.slugCounts.set(safeSlug, count + 1);
  return count === 0 ? safeSlug : `${safeSlug}-${count + 1}`;
}

function applySourceLineAttr(token: { map?: [number, number] | null; attrSet: (name: string, value: string) => void }) {
  if (!token.map || token.map.length < 2) {
    return;
  }

  token.attrSet('data-source-start', String(token.map[0] + 1));
  token.attrSet('data-source-end', String(token.map[1] + 1));
}

function normalizeFileSystemPath(value: string) {
  return value.replace(/\\/g, '/');
}

function toWorkspaceResourceUrl(filePath: string) {
  return `${WORKSPACE_RESOURCE_SCHEME}://local/?path=${encodeURIComponent(filePath)}`;
}

function getNoteFileUrl(options: MarkdownRenderOptions) {
  if (!options.workspaceRoot || !options.contentId) {
    return null;
  }

  const workspaceRoot = options.workspaceRoot.trim();
  const contentId = options.contentId.trim();
  if (!workspaceRoot || !contentId) {
    return null;
  }

  return encodeURI(
    `file:///${normalizeFileSystemPath(`${workspaceRoot}/${DATABASE_FOLDER}/${OBJECTS_FOLDER}/${contentId}.md`).replace(/^\/+/, '')}`,
  );
}

function isWindowsAbsolutePath(value: string) {
  return /^[a-z]:[\\/]/i.test(value);
}

function isAlreadyResolvableUrl(value: string) {
  return /^(?:https?:|mailto:|data:|blob:|file:|note-resource:|#|\/\/)/i.test(value);
}

function normalizeRemoteUrl(value: string) {
  return value.startsWith('//') ? `https:${value}` : value;
}

function isRemoteImageUrl(value: string) {
  return /^(?:https?:)?\/\//i.test(value);
}

function resolveLocalResourceUrl(value: string, options: MarkdownRenderOptions) {
  const trimmedValue = value.trim();
  if (!trimmedValue || isAlreadyResolvableUrl(trimmedValue)) {
    return null;
  }

  if (isWindowsAbsolutePath(trimmedValue) || trimmedValue.startsWith('/')) {
    return toWorkspaceResourceUrl(trimmedValue);
  }

  const noteFileUrl = getNoteFileUrl(options);
  if (!noteFileUrl) {
    return null;
  }

  try {
    return toWorkspaceResourceUrl(
      decodeURIComponent(new URL(normalizeFileSystemPath(trimmedValue), noteFileUrl).pathname.replace(/^\/([a-z]:)/i, '$1')),
    );
  } catch {
    return null;
  }
}

function resolveHtmlResourceUrls(html: string, options: MarkdownRenderOptions) {
  if (!html) {
    return html;
  }

  const document = new DOMParser().parseFromString(html, 'text/html');
  const imageElements = Array.from(document.body.querySelectorAll<HTMLImageElement>('img[src]'));

  for (const imageElement of imageElements) {
    const source = imageElement.getAttribute('src') ?? '';

    if (isRemoteImageUrl(source)) {
      if (options.remoteImageMode === 'all') {
        imageElement.setAttribute('src', normalizeRemoteUrl(source));
        continue;
      }

      const allowTrustedRemoteImages = options.remoteImageMode === 'trusted';
      const trustedHosts = normalizeTrustedRemoteImageHosts(
        options.trustedRemoteImageHosts,
        DEFAULT_TRUSTED_REMOTE_IMAGE_HOSTS,
      );
      if (allowTrustedRemoteImages && isTrustedRemoteImageUrl(normalizeRemoteUrl(source), trustedHosts)) {
        imageElement.setAttribute('src', normalizeRemoteUrl(source));
      } else {
        const placeholder = document.createElement('span');
        placeholder.className = 'preview-resource-placeholder preview-resource-placeholder--blocked';
        placeholder.textContent = options.blockedImageLabel ?? 'Remote image blocked';
        imageElement.replaceWith(placeholder);
      }
      continue;
    }

    const resolvedUrl = resolveLocalResourceUrl(source, options);
    if (resolvedUrl) {
      imageElement.setAttribute('src', resolvedUrl);
    }
  }

  return document.body.innerHTML;
}

function getHtmlWhitelistOptions(allowInlineSvg: boolean) {
  const allowedTags = [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'blockquote', 'p', 'a', 'ul', 'ol', 'li',
    'b', 'i', 'strong', 'em', 'strike', 'code', 'pre', 'u', 'mark', 'sub', 'sup', 'small', 'kbd',
    'hr', 'br', 'div', 'span', 'section', 'article', 'header', 'footer', 'figure', 'figcaption',
    'dl', 'dt', 'dd',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'button', 'input', 'label',
    'img', 'picture', 'source',
    'math', 'semantics', 'annotation', 'mtext', 'mspace', 'ms', 'mn', 'mi', 'mo', 'mfrac', 'msup', 'msub', 'msubsup',
    'mmultiscripts', 'munder', 'mover', 'munderover', 'mtable', 'mtr', 'mtd', 'maction', 'menclose', 'merror',
    'mfenced', 'mphantom', 'mroot', 'msqrt', 'mstyle',
  ];

  const allowedAttrs = [
    'href', 'name', 'target', 'rel', 'src', 'srcset', 'sizes', 'type', 'media',
    'alt', 'title', 'width', 'height', 'class', 'id', 'role', 'focusable', 'aria-hidden', 'aria-label',
    'checked', 'disabled', 'for',
    'data-source-start', 'data-source-end', 'data-heading-id',
    'style',
    'encoding', 'display',
  ];

  if (allowInlineSvg) {
    allowedTags.push(
      'svg', 'g', 'path', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'rect', 'defs', 'symbol', 'use',
    );
    allowedAttrs.push(
      'viewBox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit',
      'stroke-dasharray', 'opacity', 'transform', 'preserveAspectRatio',
      'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'x2', 'y1', 'y2', 'points', 'd',
      'xmlns', 'xmlns:xlink', 'xlink:href',
    );
  }

  return {
    ALLOWED_TAGS: allowedTags,
    ALLOWED_ATTR: allowedAttrs,
    ALLOW_DATA_ATTR: true,
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
  };
}

function escapeAttributeValue(markdownIt: MarkdownIt, value: string) {
  return markdownIt.utils.escapeHtml(value);
}

function renderMermaidBlock(markdownIt: MarkdownIt, token: MarkdownCodeBlockToken) {
  let wrapperAttrHtml = '';
  if (token.map && token.map.length >= 2) {
    wrapperAttrHtml = ` data-source-start="${token.map[0] + 1}" data-source-end="${token.map[1] + 1}"`;
  }

  return `<div class="preview-mermaid-block"${wrapperAttrHtml}><pre class="mermaid">${markdownIt.utils.escapeHtml(token.content)}</pre></div>\n`;
}

function renderCodeBlock(
  markdownIt: MarkdownIt,
  token: MarkdownCodeBlockToken,
  rawLanguage: string,
  copyCodeButtonLabel?: string,
) {
  let wrapperAttrHtml = '';
  if (token.map && token.map.length >= 2) {
    wrapperAttrHtml = ` data-source-start="${token.map[0] + 1}" data-source-end="${token.map[1] + 1}"`;
  }
  const { html, language, languageLabel } = highlightMarkdownCode(token.content, rawLanguage);
  const codeClasses = ['hljs'];

  if (language) {
    codeClasses.push(`language-${language}`);
  }

  const languageBadgeHtml = languageLabel
    ? `<span class="preview-code-block__language">${escapeAttributeValue(markdownIt, languageLabel)}</span>`
    : '';

  const copyButtonHtml = copyCodeButtonLabel
    ? `<button type="button" class="preview-code-block__copy" data-copy-code data-copy-label="${escapeAttributeValue(markdownIt, copyCodeButtonLabel)}" aria-label="${escapeAttributeValue(markdownIt, copyCodeButtonLabel)}">${escapeAttributeValue(markdownIt, copyCodeButtonLabel)}</button>`
    : '';

  const toolbarHtml = languageBadgeHtml || copyButtonHtml
    ? `<div class="preview-code-block__toolbar">${languageBadgeHtml}${copyButtonHtml}</div>`
    : '';

  return `<div class="preview-code-block"${wrapperAttrHtml}>${toolbarHtml}<pre><code class="${codeClasses.join(' ')}">${html}</code></pre></div>\n`;
}

function createMarkdownIt(allowHtml: boolean, renderOptions: MarkdownRenderOptions) {
  const markdownIt = new MarkdownIt({
    html: allowHtml,
    linkify: true,
    typographer: false,
    breaks: false,
  });

  markdownIt.use(markdownItTaskLists, {
    enabled: false,
    label: true,
    labelAfter: true,
  });
  markdownIt.use(markdownItKatex);

  const defaultValidateLink = markdownIt.validateLink.bind(markdownIt);
  markdownIt.validateLink = (url: string) => {
    const safeUrl = url.trim().toLowerCase();
    if (safeUrl.startsWith('javascript:') || safeUrl.startsWith('data:')) {
      return false;
    }

    return defaultValidateLink(url);
  };

  const defaultLinkRenderer = markdownIt.renderer.rules.link_open
    ?? ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

  markdownIt.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    token.attrSet('target', '_blank');
    token.attrSet('rel', 'noopener noreferrer');
    return defaultLinkRenderer(tokens, idx, options, env, self);
  };

  const defaultHeadingRenderer = markdownIt.renderer.rules.heading_open
    ?? ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));

  markdownIt.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const inlineToken = tokens[idx + 1];
    const headingText = extractInlineText(inlineToken);
    const line = (token.map?.[0] ?? 0) + 1;
    const headingId = getUniqueHeadingId(
      env as MarkdownCompileEnv,
      slugifyHeading(headingText) || `section-${line}`,
    );

    applySourceLineAttr(token);
    token.attrSet('id', headingId);
    token.attrSet('data-heading-id', headingId);

    (env as MarkdownCompileEnv).headings.push({
      id: headingId,
      level: Number.parseInt(token.tag.replace('h', ''), 10) || 1,
      title: headingText || `Heading ${line}`,
      line,
    });

    return defaultHeadingRenderer(tokens, idx, options, env, self);
  };

  const sourceMappedTokenTypes = [
    'paragraph_open',
    'blockquote_open',
    'bullet_list_open',
    'ordered_list_open',
    'list_item_open',
      'table_open',
      'dl_open',
      'dt_open',
      'dd_open',
      'thead_open',
      'tbody_open',
      'tr_open',
  ];

  for (const tokenType of sourceMappedTokenTypes) {
    const defaultRenderer = markdownIt.renderer.rules[tokenType]
      ?? ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));

    markdownIt.renderer.rules[tokenType] = (tokens, idx, options, env, self) => {
      applySourceLineAttr(tokens[idx]);
      return defaultRenderer(tokens, idx, options, env, self);
    };
  }

  markdownIt.renderer.rules.hr = (tokens, idx, options, _env, self) => {
    const token = tokens[idx];
    applySourceLineAttr(token);
    return `<hr${self.renderAttrs(token)}>\n`;
  };

  markdownIt.renderer.rules.code_block = (tokens, idx) => {
    const token = tokens[idx];
    return renderCodeBlock(markdownIt, token, '', renderOptions.copyCodeButtonLabel);
  };

  markdownIt.renderer.rules.fence = (tokens, idx) => {
    const token = tokens[idx];
    const info = token.info ? markdownIt.utils.unescapeAll(token.info).trim() : '';
    const languageName = info ? info.split(/\s+/, 1)[0] : '';
    if (languageName.toLowerCase() === 'mermaid') {
      return renderMermaidBlock(markdownIt, token);
    }

    return renderCodeBlock(markdownIt, token, languageName, renderOptions.copyCodeButtonLabel);
  };

  return markdownIt;
}

export function compileMarkdown(markdown: string, options: MarkdownRenderOptions = {}): MarkdownRenderResult {
  const allowHtml = options.allowHtml ?? true;
  const allowInlineSvg = options.allowInlineSvg ?? true;
  const env: MarkdownCompileEnv = {
    headings: [],
    slugCounts: new Map<string, number>(),
  };
  const parser = createMarkdownIt(allowHtml, options);
  const html = parser.render(markdown, env);
  const sanitizedHtml = DOMPurify.sanitize(html, getHtmlWhitelistOptions(allowInlineSvg));

  return {
    html: resolveHtmlResourceUrls(sanitizedHtml, options),
    headings: env.headings,
  };
}

export function renderMarkdown(markdown: string, options: MarkdownRenderOptions = {}) {
  return compileMarkdown(markdown, options).html;
}
