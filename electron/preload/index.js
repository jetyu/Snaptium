import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../main/constants/channels.constants.js';

const electronAPI = Object.freeze({
  openFile: () => ipcRenderer.invoke(IPC_CHANNELS.OPEN_FILE),
  saveFile: (payload) => ipcRenderer.invoke(IPC_CHANNELS.SAVE_FILE, payload),
  log: (payload) => ipcRenderer.send('logger:log', payload),
  vfs: {
    initWorkspace: (rootPath) => ipcRenderer.invoke(IPC_CHANNELS.VFS_INIT, rootPath),
    createFile: (payload) => ipcRenderer.invoke(IPC_CHANNELS.VFS_CREATE_FILE, payload),
    readContent: (contentId) => ipcRenderer.invoke(IPC_CHANNELS.VFS_READ_CONTENT, contentId),
    writeContent: (payload) => ipcRenderer.invoke(IPC_CHANNELS.VFS_WRITE_CONTENT, payload)
  }
});

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
