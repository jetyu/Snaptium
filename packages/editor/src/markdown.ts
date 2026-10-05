import type { Root, RootContent } from 'mdast';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';

export const MARKDOWN_FORMAT_VERSION = '1';
// Prototype resource bound; the persisted-note quota is a separate product decision.
export const MAX_EDITOR_BYTES = 512 * 1024;
export type MarkdownIssue = 'unsupportedMarkdown' | 'unsafeUrl' | 'documentTooLarge' | 'editorUnavailable';

export class MarkdownValidationError extends Error {
  constructor(public readonly code: MarkdownIssue) { super(code); }
}

const parser = unified().use(remarkParse).use(remarkGfm);
const supported = new Set([
  'root', 'paragraph', 'heading', 'text', 'emphasis', 'strong', 'delete',
  'list', 'listItem', 'blockquote', 'code', 'inlineCode', 'break',
  'link', 'image', 'thematicBreak',
]);

export function isSafeUrl(value: string): boolean {
  if (!value || Array.from(value).some((character) => character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127 || character === '\\')) return false;
  if (value.startsWith('//')) return false;
  if (value.startsWith('#')) return true;
  try {
    const url = new URL(value, 'https://notes.invalid/');
    return ['https:', 'http:', 'mailto:'].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}

export function validateMarkdown(markdown: string): Root {
  if (new TextEncoder().encode(markdown).byteLength > MAX_EDITOR_BYTES) {
    throw new MarkdownValidationError('documentTooLarge');
  }
  const tree = parser.parse(markdown);
  function visit(node: Root | RootContent): void {
    if (!supported.has(node.type)) throw new MarkdownValidationError('unsupportedMarkdown');
    if (node.type === 'code' && node.meta) throw new MarkdownValidationError('unsupportedMarkdown');
    if ((node.type === 'link' || node.type === 'image') && !isSafeUrl(node.url)) {
      throw new MarkdownValidationError('unsafeUrl');
    }
    if ('children' in node) for (const child of node.children) visit(child);
  }
  visit(tree);
  return tree;
}

export function canonicalLineEndings(markdown: string): string {
  const value = markdown.replace(/\r\n?/gu, '\n');
  return value.trim() === '' ? '' : `${value.replace(/\n+$/gu, '')}\n`;
}
