import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '@renderer/core/markdown/markdownService';

describe('renderMarkdown', () => {
  it('sanitizes script tags even when html mode is enabled', () => {
    const html = renderMarkdown('<script>alert(1)</script><p>safe</p>', { allowHtml: true });
    expect(html).not.toContain('<script>');
    expect(html).toContain('<p>safe</p>');
  });

  it('blocks javascript links', () => {
    const html = renderMarkdown('[xss](javascript:alert(1))');
    expect(html).not.toContain('javascript:alert');
  });
});
