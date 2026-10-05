import { describe, expect, it } from 'vitest';
import { isSafeUrl, MAX_EDITOR_BYTES, validateMarkdown } from '@snaptium/editor';
import supported from '../../fixtures/markdown/supported.md?raw';

describe('Markdown boundary', () => {
  it('accepts the documented subset including Chinese and image references', () => {
    expect(validateMarkdown(supported).type).toBe('root');
  });
  it.each([
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '| a | b |\n| - | - |\n| 1 | 2 |',
    '引用[^1]\n\n[^1]: 脚注',
    '[文本][ref]\n\n[ref]: https://example.com',
  ])('rejects unsupported input rather than dropping it: %s', (source) => {
    expect(() => validateMarkdown(source)).toThrow('unsupportedMarkdown');
  });
  it.each(['javascript:alert(1)', 'data:text/html,test', 'file:///C:/secret', '//evil.example/a', 'https://user:pass@example.com', 'https:\\evil.example'])('rejects dangerous URL %s', (url) => {
    expect(isSafeUrl(url)).toBe(false);
  });
  it('checks decoded entity URLs in Markdown', () => {
    expect(() => validateMarkdown('[坏链接](jav&#x61;script:alert)')).toThrow('unsafeUrl');
  });
  it('allows safe links and relative image references', () => {
    for (const url of ['https://example.com', 'mailto:a@example.com', '/api/v1/attachments/image', 'images/example.png', '#标题']) expect(isSafeUrl(url)).toBe(true);
  });
  it('enforces a UTF-8 byte limit', () => {
    expect(() => validateMarkdown('中'.repeat(Math.ceil(MAX_EDITOR_BYTES / 3)))).toThrow('documentTooLarge');
  });
});
