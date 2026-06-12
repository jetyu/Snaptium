import { dialog, ipcMain, clipboard, type BrowserWindow } from 'electron';
import { z } from 'zod';
import { readUtf8, writeUtf8 } from '../../services/file.service.js';
import { IPC_CHANNELS } from '../../constants/ipc.constants.js';
import { loggerService } from '../../services/logger.service.js';

const logger = loggerService.createLogger('Electron:Editor IPC');
const clipboardTextSchema = z.string();

const saveFilePayloadSchema = z.object({
  filePath: z.string().min(1).nullable(),
  content: z.string(),
});

export function registerEditorIpcHandlers(mainWindow: BrowserWindow): void {
  ipcMain.handle(IPC_CHANNELS.EDITOR_READ_CLIPBOARD, async () => {
    return clipboard.readText();
  });

  ipcMain.handle(IPC_CHANNELS.EDITOR_WRITE_CLIPBOARD, async (_event, text: unknown) => {
    clipboard.writeText(clipboardTextSchema.parse(text));
  });

  ipcMain.handle(IPC_CHANNELS.OPEN_FILE, async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }],
    });
    logger.debug('Opening file', { canceled, selectedCount: filePaths.length });
    if (canceled || filePaths.length === 0) {
      return null;
    }

    const filePath = filePaths[0];
    const content = await readUtf8(filePath);
    return { filePath, content };
  });

  ipcMain.handle(IPC_CHANNELS.SAVE_FILE, async (_event, payload: unknown) => {
    const parsed = saveFilePayloadSchema.parse(payload);
    const { filePath, content } = parsed;
    logger.debug('Saving file', { hasFilePath: Boolean(filePath), contentLength: content.length });
    if (filePath) {
      await writeUtf8(filePath, content);
      return { filePath };
    }

    const { canceled, filePath: savePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: 'untitled.md',
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    });
    logger.debug('Saving file via dialog', { canceled, hasSavePath: Boolean(savePath) });
    if (canceled || !savePath) {
      return null;
    }

    await writeUtf8(savePath, content);
    return { filePath: savePath };
  });
}
