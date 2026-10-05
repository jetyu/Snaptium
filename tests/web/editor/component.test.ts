import { mount } from '@vue/test-utils';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MarkdownEditor } from '@snaptium/editor';

beforeAll(() => {
  // jsdom has no layout engine; only provide missing geometry APIs for selection commands.
  // This does not validate real browser layout or IME behavior.
  if (!Range.prototype.getClientRects) Object.defineProperty(Range.prototype, 'getClientRects', {
    configurable: true, value: () => [],
  });
  if (!Range.prototype.getBoundingClientRect) Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
    configurable: true, value: () => new DOMRect(0, 0, 0, 0),
  });
});

afterEach(() => { document.body.replaceChildren(); });

describe('editor interaction', () => {
  it('switches modes and applies source without silently discarding rejected input', async () => {
    const wrapper = mount(MarkdownEditor, { props: { initialMarkdown: '初始正文\n' }, attachTo: document.body });
    await vi.waitFor(() => expect(wrapper.get('.editor-modes button:last-child').attributes('disabled')).toBeUndefined());
    await wrapper.get('.editor-modes button:last-child').trigger('click');
    expect(wrapper.get('textarea').element.value).toBe('初始正文\n');
    await wrapper.get('textarea').setValue('<script>bad()</script>');
    await wrapper.get('.editor-modes button:first-child').trigger('click');
    expect(wrapper.get('[role="alert"]').text()).toContain('暂不支持');
    expect(wrapper.get('textarea').element.value).toBe('<script>bad()</script>');
    expect(wrapper.find('script').exists()).toBe(false);
    await wrapper.get('textarea').setValue('# 新的中文标题\n');
    await wrapper.get('.editor-modes button:first-child').trigger('click');
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(wrapper.get('.ProseMirror h1').text()).toBe('新的中文标题');
    expect(wrapper.emitted('change')).toContainEqual(['# 新的中文标题\n']);
    wrapper.unmount();
  });
  it('keeps unsupported initial Markdown in source mode', async () => {
    const source = '[文本][ref]\n\n[ref]: https://example.com';
    const wrapper = mount(MarkdownEditor, { props: { initialMarkdown: source }, attachTo: document.body });
    await vi.waitFor(() => expect(wrapper.find('textarea').exists()).toBe(true));
    expect(wrapper.get('textarea').element.value).toBe(source);
    expect(wrapper.get('[role="alert"]').text()).toContain('暂不支持');
    wrapper.unmount();
  });
  it('disables formatting and mode changes during composition', async () => {
    const wrapper = mount(MarkdownEditor, { props: { initialMarkdown: '中文\n' }, attachTo: document.body });
    await vi.waitFor(() => expect(wrapper.get('.editor-modes button:last-child').attributes('disabled')).toBeUndefined());
    await wrapper.get('.ProseMirror').trigger('compositionstart');
    expect(wrapper.get('.editor-modes button:last-child').attributes('disabled')).toBeDefined();
    expect(wrapper.get('.editor-toolbar button').attributes('disabled')).toBeDefined();
    await wrapper.get('.ProseMirror').trigger('compositionend');
    expect(wrapper.get('.editor-modes button:last-child').attributes('disabled')).toBeUndefined();
    wrapper.unmount();
  });
  it('applies heading formatting and preserves undo/redo history', async () => {
    const wrapper = mount(MarkdownEditor, { props: { initialMarkdown: '正文\n' }, attachTo: document.body });
    await vi.waitFor(() => expect(wrapper.get('.editor-modes button:last-child').attributes('disabled')).toBeUndefined());
    await wrapper.get('.editor-toolbar button:nth-child(4)').trigger('click');
    expect(wrapper.get('.ProseMirror h2').text()).toBe('正文');
    expect(wrapper.emitted('draft')).toContainEqual([{ markdown: '## 正文\n', mode: 'rich' }]);
    await wrapper.get('.editor-toolbar button:nth-child(7)').trigger('click');
    expect(wrapper.get('.ProseMirror p').text()).toBe('正文');
    await wrapper.get('.editor-toolbar button:nth-child(8)').trigger('click');
    expect(wrapper.get('.ProseMirror h2').text()).toBe('正文');
    wrapper.unmount();
  });
});
