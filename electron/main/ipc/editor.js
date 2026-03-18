import { dialog, ipcMain } from 'electron';
import { z } from 'zod';
import { readUtf8, writeUtf8 } from '../services/file.service.js';
import { IPC_CHANNELS } from '../constants/channels.constants.js';

const saveFilePayloadSchema = z.object({
  filePath: z.string().min(1).nullable(),
  content: z.string(),
});

export function registerEditorIpcHandlers(mainWindow) {
  ipcMain.handle(IPC_CHANNELS.OPEN_FILE, async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }],
    });

    if (canceled || filePaths.length === 0) {
      return null;
    }

    const filePath = filePaths[0];
    const content = await readUtf8(filePath);
    return { filePath, content };
  });

  ipcMain.handle(IPC_CHANNELS.SAVE_FILE, async (_event, payload) => {
    const parsed = saveFilePayloadSchema.parse(payload);
    const { filePath, content } = parsed;

    if (filePath) {
      await writeUtf8(filePath, content);
      return { filePath };
    }

    const { canceled, filePath: savePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: 'untitled.md',
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    });

    if (canceled || !savePath) {
      return null;
    }

    await writeUtf8(savePath, content);
    return { filePath: savePath };
  });
}
