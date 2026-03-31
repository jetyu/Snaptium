import { registerEditorIpcHandlers } from './editor.js';
import { registerLoggerIpcHandlers } from './modules/logger.js';
import { registerSettingsIpcHandlers } from './modules/settings.js';
import { registerAiSourceIpcHandlers } from './modules/ai-source.js';
import { registerAiAssistantIpcHandlers } from './modules/ai-assistant.js';
import { registerAppEnvInfoIpcHandlers } from './modules/app-env-info.js';
import { registerVfsIpcHandlers } from './vfs.js';
import { registerWorkspaceMenuIpcHandlers } from './workspace-menu.js';

export function registerIpcHandlers(mainWindow) {
  registerEditorIpcHandlers(mainWindow);
  registerLoggerIpcHandlers();
  registerSettingsIpcHandlers();
  registerAiSourceIpcHandlers();
  registerAiAssistantIpcHandlers();
  registerAppEnvInfoIpcHandlers();
  registerVfsIpcHandlers();
  registerWorkspaceMenuIpcHandlers(mainWindow);
}
