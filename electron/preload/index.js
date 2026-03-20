// Generated from electron/preload/src/index.js. Edit the source file, not this build artifact.
'use strict';

const electron = require('electron');

const IPC_CHANNELS = Object.freeze({
  OPEN_FILE: 'editor:open-file',
  SAVE_FILE: 'editor:save-file',
  VFS_INIT: 'vfs:init',
  VFS_CREATE_FILE: 'vfs:create-file',
  VFS_READ_CONTENT: 'vfs:read-content',
  VFS_WRITE_CONTENT: 'vfs:write-content'
});

const electronAPI = Object.freeze({
  openFile: () => electron.ipcRenderer.invoke(IPC_CHANNELS.OPEN_FILE),
  saveFile: (payload) => electron.ipcRenderer.invoke(IPC_CHANNELS.SAVE_FILE, payload),
  log: (payload) => electron.ipcRenderer.send('logger:log', payload),
  vfs: Object.freeze({
    initWorkspace: (rootPath) => electron.ipcRenderer.invoke(IPC_CHANNELS.VFS_INIT, rootPath),
    createFile: (payload) => electron.ipcRenderer.invoke(IPC_CHANNELS.VFS_CREATE_FILE, payload),
    readContent: (contentId) => electron.ipcRenderer.invoke(IPC_CHANNELS.VFS_READ_CONTENT, contentId),
    writeContent: (payload) => electron.ipcRenderer.invoke(IPC_CHANNELS.VFS_WRITE_CONTENT, payload)
  })
});

electron.contextBridge.exposeInMainWorld('electronAPI', electronAPI);
