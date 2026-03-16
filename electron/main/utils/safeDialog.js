export function ensureWindow(window) {
  if (!window || window.isDestroyed()) {
    throw new Error('Main window is not available');
  }
}
