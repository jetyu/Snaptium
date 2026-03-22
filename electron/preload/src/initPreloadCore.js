import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../../main/constants/channels.constants.js';

// The shared IPC constants are imported here once and inlined into the built
// sandbox-compatible preload artifact during the preload build.

const electronAPI = Object.freeze({
  openFile: () => ipcRenderer.invoke(IPC_CHANNELS.OPEN_FILE),
  saveFile: (payload) => ipcRenderer.invoke(IPC_CHANNELS.SAVE_FILE, payload),
  log: (payload) => ipcRenderer.send('logger:log', payload),
  vfs: Object.freeze({
    initWorkspace: (rootPath) => ipcRenderer.invoke(IPC_CHANNELS.VFS_INIT, rootPath),
    createFile: (payload) => ipcRenderer.invoke(IPC_CHANNELS.VFS_CREATE_FILE, payload),
    createFolder: (payload) => ipcRenderer.invoke(IPC_CHANNELS.VFS_CREATE_FOLDER, payload),
    readContent: (contentId) => ipcRenderer.invoke(IPC_CHANNELS.VFS_READ_CONTENT, contentId),
    writeContent: (payload) => ipcRenderer.invoke(IPC_CHANNELS.VFS_WRITE_CONTENT, payload),
  }),
  workspace: Object.freeze({
    showContextMenu: (payload) => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_SHOW_CONTEXT_MENU, payload),
  }),
});

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
