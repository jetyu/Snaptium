import { afterEach, describe, expect, it } from 'vitest';
import { createMarkdownEditor, readMarkdown, replaceMarkdown } from '@snaptium/editor';
import fixture from '../../fixtures/markdown/supported.md?raw';

type Editor = Awaited<ReturnType<typeof createMarkdownEditor>>;

const editors: Editor[] = [];
afterEach(async () => {
  for (const editor of editors.splice(0)) await editor.destroy();
  document.body.replaceChildren();
});

async function make(source: string): Promise<{ editor: Editor; root: HTMLElement }> {
  const root = document.createElement('div');
  document.body.append(root);
  const editor = await createMarkdownEditor(root, { initialMarkdown: source });
  editors.push(editor);
  return { editor, root };
}

describe('Milkdown canonical projection', () => {
  it('round-trips the golden supported Markdown without format churn', async () => {
    const { editor } = await make(fixture);
    expect(readMarkdown(editor)).toBe(fixture);
    replaceMarkdown(editor, readMarkdown(editor));
    expect(readMarkdown(editor)).toBe(fixture);
  });
  it('preserves image references without issuing an image load', async () => {
    const { editor, root } = await make('![中文](https://example.com/private.png)\n');
    // ProseMirror may add a separator <img> without a source for cursor handling.
    expect(root.querySelector('img[src]')).toBeNull();
    expect(root.querySelector('.editor-image-placeholder')?.textContent).toContain('中文');
    expect(readMarkdown(editor)).toBe('![中文](https://example.com/private.png)\n');
  });
  it('keeps the previous document when source replacement is unsafe or unsupported', async () => {
    const { editor, root } = await make('原始内容\n');
    for (const bad of ['<script>bad()</script>', '[bad](javascript:alert)', '|a|\n|-|\n|b|']) {
      expect(() => replaceMarkdown(editor, bad)).toThrow();
      expect(readMarkdown(editor)).toBe('原始内容\n');
    }
    expect(root.querySelector('script')).toBeNull();
  });
  it('normalizes Windows line endings and preserves escaped text', async () => {
    const { editor } = await make('# 标题\r\n\r\n转义 \\*星号\\*\r\n');
    expect(readMarkdown(editor)).toBe('# 标题\n\n转义 \\*星号\\*\n');
  });
  it.each([
    '[文档](https://example.com)\n',
    '![](images/example.png)\n',
    '```\n普通代码\n```\n',
    '第一行\n第二行\n',
    '#### 六级以内的标题\n',
  ])('preserves optional attributes and text in %s', async (source) => {
    const { editor } = await make(source);
    expect(readMarkdown(editor)).toBe(source);
  });
  it.each([
    { source: '__粗体__ 和 _斜体_\n', canonical: '__粗体__ 和 _斜体_\n' },
    { source: '第一行  \n第二行\n', canonical: '第一行\\\n第二行\n' },
    { source: '## 标题 ##\n', canonical: '## 标题\n' },
  ])('canonicalizes equivalent Markdown idempotently: $source', async ({ source, canonical }) => {
    const { editor } = await make(source);
    expect(readMarkdown(editor)).toBe(canonical);
    replaceMarkdown(editor, canonical);
    expect(readMarkdown(editor)).toBe(canonical);
  });
});
