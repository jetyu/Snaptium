import { registerEditorIpcHandlers } from './modules/editor.js';
import { registerLoggerIpcHandlers } from './modules/logger.js';
import { registerSettingsIpcHandlers } from './modules/settings.js';
import { registerAiSourceIpcHandlers } from './modules/ai-source.js';
import { registerAppEnvInfoIpcHandlers } from './modules/app-env-info.js';
import { registerVfsIpcHandlers } from './modules/vfs.js';
import { registerWorkspaceMenuIpcHandlers } from './modules/workspace-menu.js';
import { registerEditorMenuIpcHandlers } from './modules/editor-menu.js';
import { registerSearchIpcHandlers } from './modules/search.js';
import { registerShortcutsHandlers } from './modules/shortcuts.js';
import { registerRAGHandlers } from './modules/rag.js';
import { registerAIChatHandlers } from './modules/ai-chat.js';
import { registerSyncHandlers } from './modules/sync.js';
import { registerUpdaterHandlers } from './modules/updater.js';
import { registerImportExportIpcHandlers } from './modules/import-export.js';
import { registerE2eeHandlers } from './modules/e2ee.js';
import { registerWindowIpcHandlers } from './modules/window.js';
import type { BrowserWindow } from 'electron';

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  registerEditorIpcHandlers(mainWindow);
  registerLoggerIpcHandlers();
  registerSettingsIpcHandlers();
  registerAiSourceIpcHandlers();
  registerAppEnvInfoIpcHandlers();
  registerVfsIpcHandlers();
  registerWorkspaceMenuIpcHandlers(mainWindow);
  registerEditorMenuIpcHandlers(mainWindow);
  registerSearchIpcHandlers();
  registerShortcutsHandlers();
  registerRAGHandlers();
  registerAIChatHandlers();
  registerSyncHandlers();
  registerUpdaterHandlers();
  registerImportExportIpcHandlers();
  registerE2eeHandlers();
  registerWindowIpcHandlers(mainWindow);
}
