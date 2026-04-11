import DOMPurify from 'dompurify';
import MarkdownIt from 'markdown-it';

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

const HTML_WHITELIST_OPTIONS = {
  ALLOWED_TAGS: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'blockquote', 'p', 'a', 'ul', 'ol', 'li',
    'b', 'i', 'strong', 'em', 'strike', 'code', 'pre',
    'hr', 'br', 'div', 'span', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'img',
  ],
  ALLOWED_ATTR: ['href', 'name', 'target', 'rel', 'src', 'alt', 'title', 'width', 'height', 'class'],
  ALLOW_DATA_ATTR: false,
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
};

export function renderMarkdown(markdown: string, options?: { allowHtml?: boolean }) {
  const allowHtml = options?.allowHtml ?? false;

  if (allowHtml) {
    const htmlEnabled = markdownIt.set({ html: true }).render(markdown);
    markdownIt.set({ html: false });
    return DOMPurify.sanitize(htmlEnabled, HTML_WHITELIST_OPTIONS);
  }

  const html = markdownIt.render(markdown);
  return DOMPurify.sanitize(html, HTML_WHITELIST_OPTIONS);
}
