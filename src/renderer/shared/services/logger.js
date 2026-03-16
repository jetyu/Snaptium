export const logger = {
  info: (...args) => console.info('[Renderer]', ...args),
  warn: (...args) => console.warn('[Renderer]', ...args),
  error: (...args) => console.error('[Renderer]', ...args),
};
