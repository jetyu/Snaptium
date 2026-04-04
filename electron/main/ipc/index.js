import { registerEditorIpcHandlers } from './/modules/editor.js';
import { registerLoggerIpcHandlers } from './modules/logger.js';
import { registerSettingsIpcHandlers } from './modules/settings.js';
import { registerAiSourceIpcHandlers } from './modules/ai-source.js';
import { registerAiAssistantIpcHandlers } from './modules/ai-assistant.js';
import { registerAppEnvInfoIpcHandlers } from './modules/app-env-info.js';
import { registerVfsIpcHandlers } from './modules/vfs.js';
import { registerWorkspaceMenuIpcHandlers } from './modules/workspace-menu.js';
import { registerEditorMenuIpcHandlers } from './modules/editor-menu.js';
import { registerSearchIpcHandlers } from './modules/search.js';
import { registerShortcutsHandlers } from './modules/shortcuts.js';
import { registerRAGHandlers } from './modules/rag.js';
import { registerAIChatHandlers } from './modules/ai-chat.js';
import { registerUpdaterHandlers } from './modules/updater.js';

export function registerIpcHandlers(mainWindow) {
  registerEditorIpcHandlers(mainWindow);
  registerLoggerIpcHandlers();
  registerSettingsIpcHandlers();
  registerAiSourceIpcHandlers();
  registerAiAssistantIpcHandlers();
  registerAppEnvInfoIpcHandlers();
  registerVfsIpcHandlers();
  registerWorkspaceMenuIpcHandlers(mainWindow);
  registerEditorMenuIpcHandlers(mainWindow);
  registerSearchIpcHandlers();
  registerShortcutsHandlers();
  registerRAGHandlers();
  registerAIChatHandlers();
  registerUpdaterHandlers();
}
