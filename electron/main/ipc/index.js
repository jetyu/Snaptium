import { registerEditorIpcHandlers } from './editor.js';
import { registerLoggerIpcHandlers } from './modules/logger.js';
import { registerSettingsIpcHandlers } from './modules/settings.js';
import { registerVfsIpcHandlers } from './vfs.js';
import { registerWorkspaceMenuIpcHandlers } from './workspace-menu.js';

export function registerIpcHandlers(mainWindow) {
  registerEditorIpcHandlers(mainWindow);
  registerLoggerIpcHandlers();
  registerSettingsIpcHandlers();
  registerVfsIpcHandlers();
  registerWorkspaceMenuIpcHandlers(mainWindow);
}
