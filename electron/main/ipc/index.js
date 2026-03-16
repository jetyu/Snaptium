import { registerEditorIpcHandlers } from './editor.js';

export function registerIpcHandlers(mainWindow) {
  registerEditorIpcHandlers(mainWindow);
}
