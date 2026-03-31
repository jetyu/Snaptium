import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../constants/ipc.constants.js';
import { vfsService } from '../services/vfs.service.js';

export function registerVfsIpcHandlers() {
  ipcMain.removeHandler(IPC_CHANNELS.VFS_INIT);
  ipcMain.removeHandler(IPC_CHANNELS.VFS_CREATE_FILE);
  ipcMain.removeHandler(IPC_CHANNELS.VFS_CREATE_FOLDER);
  ipcMain.removeHandler(IPC_CHANNELS.VFS_RENAME_NODE);
  ipcMain.removeHandler(IPC_CHANNELS.VFS_READ_CONTENT);
  ipcMain.removeHandler(IPC_CHANNELS.VFS_WRITE_CONTENT);
  ipcMain.removeHandler(IPC_CHANNELS.VFS_SHOW_NOTE_IN_FOLDER);
  ipcMain.removeHandler(IPC_CHANNELS.VFS_DELETE_NODE);
  ipcMain.removeHandler(IPC_CHANNELS.VFS_TOGGLE_NODE_LOCK);

  ipcMain.handle(IPC_CHANNELS.VFS_INIT, (_event, rootPath) =>
    vfsService.initializeWorkspace(rootPath),
  );

  ipcMain.handle(IPC_CHANNELS.VFS_CREATE_FILE, (_event, payload = {}) =>
    vfsService.createFile(payload.parentId ?? null, payload.name, payload.content ?? ''),
  );

  ipcMain.handle(IPC_CHANNELS.VFS_CREATE_FOLDER, (_event, payload = {}) =>
    vfsService.createFolder(payload.parentId ?? null, payload.name),
  );

  ipcMain.handle(IPC_CHANNELS.VFS_RENAME_NODE, (_event, payload = {}) =>
    vfsService.renameNode(payload.nodeId, payload.name),
  );

  ipcMain.handle(IPC_CHANNELS.VFS_READ_CONTENT, (_event, contentId) =>
    vfsService.readContent(contentId),
  );

  ipcMain.handle(IPC_CHANNELS.VFS_WRITE_CONTENT, (_event, payload = {}) =>
    vfsService.writeContent(payload.contentId, payload.content),
  );

  ipcMain.handle(IPC_CHANNELS.VFS_SHOW_NOTE_IN_FOLDER, (_event, nodeId) =>
    vfsService.showNoteInFolder(nodeId),
  );

  ipcMain.handle(IPC_CHANNELS.VFS_DELETE_NODE, (_event, nodeId) =>
    vfsService.deleteNode(nodeId),
  );

  ipcMain.handle(IPC_CHANNELS.VFS_TOGGLE_NODE_LOCK, (_event, payload = {}) =>
    vfsService.toggleNodeLock(payload.nodeId, payload.locked),
  );
}
