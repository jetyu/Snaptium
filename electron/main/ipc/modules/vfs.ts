import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../constants/ipc.constants.js';
import { vfsService } from '../../services/vfs.service.js';
import { loggerService } from '../../services/logger.service.js';
import { z } from 'zod';
import { isNotebookIconColor, normalizeNotebookIconEmoji } from '../../../shared/notebook-icon.constants.js';

const logger = loggerService.createLogger('Electron:VFS IPC');

// Schemas
const uuidSchema = z.string().uuid();
const parentIdSchema = uuidSchema.nullable();
const nameSchema = z.string().min(1).max(255);
const nodeIndexSchema = z.number().int().min(0);
const notebookIconColorSchema = z.string().refine((value) => isNotebookIconColor(value), {
  message: 'Invalid notebook icon color',
});
const notebookIconEmojiSchema = z.string().refine((value) => normalizeNotebookIconEmoji(value) === value, {
  message: 'Invalid notebook icon emoji',
});

export function registerVfsIpcHandlers() {
  ipcMain.removeHandler(IPC_CHANNELS.VFS_INIT);
  ipcMain.removeHandler(IPC_CHANNELS.VFS_CREATE_FILE);
  ipcMain.removeHandler(IPC_CHANNELS.VFS_CREATE_FOLDER);
  ipcMain.removeHandler(IPC_CHANNELS.VFS_RENAME_NODE);
  ipcMain.removeHandler(IPC_CHANNELS.VFS_READ_CONTENT);
  ipcMain.removeHandler(IPC_CHANNELS.VFS_WRITE_CONTENT);
  ipcMain.removeHandler(IPC_CHANNELS.VFS_SAVE_IMAGE);
  ipcMain.removeHandler(IPC_CHANNELS.VFS_SHOW_NOTE_IN_FOLDER);
  ipcMain.removeHandler(IPC_CHANNELS.VFS_DELETE_NODES);
  ipcMain.removeHandler(IPC_CHANNELS.VFS_TOGGLE_NODE_LOCK);
  ipcMain.removeHandler(IPC_CHANNELS.VFS_UPDATE_NOTEBOOK_ICON_COLOR);
  ipcMain.removeHandler(IPC_CHANNELS.VFS_UPDATE_NOTEBOOK_ICON_EMOJI);
  ipcMain.removeHandler(IPC_CHANNELS.VFS_UPDATE_NODE_TAGS);
  ipcMain.removeHandler(IPC_CHANNELS.VFS_GET_TRASHED_NODES);
  ipcMain.removeHandler(IPC_CHANNELS.VFS_RESTORE_NODE);
  ipcMain.removeHandler(IPC_CHANNELS.VFS_PERMANENTLY_DELETE_NODE);
  ipcMain.removeHandler(IPC_CHANNELS.VFS_EMPTY_TRASH);
  ipcMain.removeHandler(IPC_CHANNELS.VFS_CONFIRM_PERMANENT_DELETE_NODE);
  ipcMain.removeHandler(IPC_CHANNELS.VFS_CONFIRM_EMPTY_TRASH);
  ipcMain.removeHandler(IPC_CHANNELS.VFS_CONFIRM_DELETE_NODE);
  ipcMain.removeHandler(IPC_CHANNELS.VFS_CONFIRM_RECOVER_VERSION);
  ipcMain.removeHandler(IPC_CHANNELS.VFS_GET_HISTORY);
  ipcMain.removeHandler(IPC_CHANNELS.VFS_GET_HISTORY_CONTENT);
  ipcMain.removeHandler(IPC_CHANNELS.VFS_MOVE_NODE);
  ipcMain.removeHandler(IPC_CHANNELS.VFS_RECOVER_VERSION);
  ipcMain.removeHandler(IPC_CHANNELS.VFS_TOGGLE_NODE_STAR);
  ipcMain.removeHandler(IPC_CHANNELS.VFS_GET_STARRED_NODES);

  ipcMain.handle(IPC_CHANNELS.VFS_INIT, (_event, rootPath) => {
    const schema = z.string().optional();
    return vfsService.initializeWorkspace(schema.parse(rootPath));
  });

  ipcMain.handle(IPC_CHANNELS.VFS_CREATE_FILE, (_event, payload = {}) => {
    const schema = z.object({
      parentId: parentIdSchema,
      name: nameSchema,
      content: z.string().optional().default(''),
    });
    const data = schema.parse(payload);
    return vfsService.createFile(data.parentId, data.name, data.content);
  });

  ipcMain.handle(IPC_CHANNELS.VFS_CREATE_FOLDER, (_event, payload = {}) => {
    const schema = z.object({
      parentId: parentIdSchema,
      name: nameSchema,
    });
    const data = schema.parse(payload);
    return vfsService.createFolder(data.parentId, data.name);
  });

  ipcMain.handle(IPC_CHANNELS.VFS_RENAME_NODE, (_event, payload = {}) => {
    const schema = z.object({
      nodeId: uuidSchema,
      name: nameSchema,
    });
    const data = schema.parse(payload);
    return vfsService.renameNode(data.nodeId, data.name);
  });

  ipcMain.handle(IPC_CHANNELS.VFS_READ_CONTENT, (_event, contentId) => {
    return vfsService.readContent(uuidSchema.parse(contentId));
  });

  ipcMain.handle(IPC_CHANNELS.VFS_WRITE_CONTENT, (_event, payload = {}) => {
    const schema = z.object({
      contentId: uuidSchema,
      content: z.string(),
    });
    const data = schema.parse(payload);
    return vfsService.writeContent(data.contentId, data.content);
  });

  ipcMain.handle(IPC_CHANNELS.VFS_SAVE_IMAGE, (_event, payload = {}) => {
    const schema = z.object({
      contentId: uuidSchema,
      fileName: z.string().min(1).max(255).optional(),
      mimeType: z.string().regex(/^image\//i),
      dataBase64: z.string().min(1),
    });
    const data = schema.parse(payload);
    return vfsService.saveImage(data.contentId, {
      fileName: data.fileName,
      mimeType: data.mimeType,
      dataBase64: data.dataBase64,
    });
  });

  ipcMain.handle(IPC_CHANNELS.VFS_SHOW_NOTE_IN_FOLDER, (_event, nodeId) => {
    return vfsService.showNoteInFolder(uuidSchema.parse(nodeId));
  });

  ipcMain.handle(IPC_CHANNELS.VFS_DELETE_NODES, (_event, nodeIds = []) => {
    const schema = z.array(uuidSchema).min(1);
    return vfsService.deleteNodes(schema.parse(nodeIds));
  });

  ipcMain.handle(IPC_CHANNELS.VFS_TOGGLE_NODE_LOCK, (_event, payload = {}) => {
    const schema = z.object({
      nodeId: uuidSchema,
      locked: z.boolean(),
    });
    const data = schema.parse(payload);
    return vfsService.toggleNodeLock(data.nodeId, data.locked);
  });

  ipcMain.handle(IPC_CHANNELS.VFS_UPDATE_NOTEBOOK_ICON_COLOR, (_event, payload = {}) => {
    const schema = z.object({
      nodeId: uuidSchema,
      iconColor: notebookIconColorSchema.nullable(),
    });
    const data = schema.parse(payload);
    return vfsService.updateNotebookIconColor(data.nodeId, data.iconColor);
  });

  ipcMain.handle(IPC_CHANNELS.VFS_UPDATE_NOTEBOOK_ICON_EMOJI, (_event, payload = {}) => {
    const schema = z.object({
      nodeId: uuidSchema,
      iconEmoji: notebookIconEmojiSchema.nullable(),
    });
    const data = schema.parse(payload);
    return vfsService.updateNotebookIconEmoji(data.nodeId, data.iconEmoji);
  });

  ipcMain.handle(IPC_CHANNELS.VFS_UPDATE_NODE_TAGS, (_event, payload = {}) => {
    const schema = z.object({
      nodeId: uuidSchema,
      tags: z.array(z.string().min(1).max(48)).max(5),
    });
    const data = schema.parse(payload);
    return vfsService.updateNodeTags(data.nodeId, data.tags);
  });
  
  ipcMain.handle(IPC_CHANNELS.VFS_GET_TRASHED_NODES, () =>
    vfsService.getTrashedNodes(),
  );

  ipcMain.handle(IPC_CHANNELS.VFS_RESTORE_NODE, (_event, nodeId) => {
    return vfsService.restoreNode(uuidSchema.parse(nodeId));
  });

  ipcMain.handle(IPC_CHANNELS.VFS_PERMANENTLY_DELETE_NODE, (_event, nodeId) => {
    return vfsService.permanentlyDeleteNode(uuidSchema.parse(nodeId));
  });

  ipcMain.handle(IPC_CHANNELS.VFS_EMPTY_TRASH, () =>
    vfsService.emptyTrash(),
  );

  ipcMain.handle(IPC_CHANNELS.VFS_CONFIRM_PERMANENT_DELETE_NODE, () => {
    return vfsService.confirmPermanentDeleteNode();
  });

  ipcMain.handle(IPC_CHANNELS.VFS_CONFIRM_EMPTY_TRASH, () => {
    return vfsService.confirmEmptyTrash();
  });

  ipcMain.handle(IPC_CHANNELS.VFS_CONFIRM_DELETE_NODE, (_event, nodeName) => {
    return vfsService.confirmDeleteNode(nodeName);
  });

  ipcMain.handle(IPC_CHANNELS.VFS_CONFIRM_RECOVER_VERSION, () => {
    return vfsService.confirmRecoverVersion();
  });

  ipcMain.handle(IPC_CHANNELS.VFS_GET_HISTORY, (_event, contentId) => {
    return vfsService.getHistory(uuidSchema.parse(contentId));
  });

  ipcMain.handle(IPC_CHANNELS.VFS_GET_HISTORY_CONTENT, (_event, payload = {}) => {
    const schema = z.object({
      contentId: uuidSchema,
      filename: z.string(),
    });
    const data = schema.parse(payload);
    return vfsService.getHistoryContent(data.contentId, data.filename);
  });

  ipcMain.handle(IPC_CHANNELS.VFS_MOVE_NODE, (_event, payload = {}) => {
    const schema = z.object({
      nodeId: uuidSchema,
      parentId: parentIdSchema,
      index: nodeIndexSchema,
    });
    const data = schema.parse(payload);
    return vfsService.moveNode(data.nodeId, data.parentId, data.index);
  });

  ipcMain.handle(IPC_CHANNELS.VFS_RECOVER_VERSION, (_event, payload = {}) => {
    const schema = z.object({
      nodeId: uuidSchema,
      filename: z.string(),
    });
    const data = schema.parse(payload);
    return vfsService.recoverVersion(data.nodeId, data.filename);
  });

  ipcMain.handle(IPC_CHANNELS.VFS_TOGGLE_NODE_STAR, (_event, payload = {}) => {
    const schema = z.object({
      nodeId: uuidSchema,
      starred: z.boolean(),
    });
    const data = schema.parse(payload);
    return vfsService.toggleNodeStar(data.nodeId, data.starred);
  });

  ipcMain.handle(IPC_CHANNELS.VFS_GET_STARRED_NODES, () =>
    vfsService.getStarredNodes()
  );

  logger.debug('VFS IPC handlers registered');
}
