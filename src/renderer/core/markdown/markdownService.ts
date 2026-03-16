import MarkdownIt from 'markdown-it';
import sanitizeHtml from 'sanitize-html';

const markdownIt = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: true,
});

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
  token.attrSet('rel', 'noopener noreferrer nofollow');
  return defaultLinkRenderer(tokens, idx, options, env, self);
};

const HTML_WHITELIST_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'blockquote', 'p', 'a', 'ul', 'ol', 'li',
    'b', 'i', 'strong', 'em', 'strike', 'code', 'pre',
    'hr', 'br', 'div', 'span', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'img',
  ],
  allowedAttributes: {
    a: ['href', 'name', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    '*': ['class'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  disallowedTagsMode: 'discard',
};

export function renderMarkdown(markdown: string, options?: { allowHtml?: boolean }) {
  const allowHtml = options?.allowHtml ?? false;

  if (allowHtml) {
    const htmlEnabled = markdownIt.set({ html: true }).render(markdown);
    markdownIt.set({ html: false });
    return sanitizeHtml(htmlEnabled, HTML_WHITELIST_OPTIONS);
  }

  const html = markdownIt.render(markdown);
  return sanitizeHtml(html, HTML_WHITELIST_OPTIONS);
}
