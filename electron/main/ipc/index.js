import { registerEditorIpcHandlers } from './editor.js';
import { registerLoggerIpcHandlers } from './modules/logger.js';
import { registerVfsIpcHandlers } from './vfs.js';

export function registerIpcHandlers(mainWindow) {
  registerEditorIpcHandlers(mainWindow);
  registerLoggerIpcHandlers();
  registerVfsIpcHandlers();
}
