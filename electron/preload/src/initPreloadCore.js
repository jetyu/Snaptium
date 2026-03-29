import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../../main/constants/channels.constants.js';

// The shared IPC constants are imported here once and inlined into the built
// sandbox-compatible preload artifact during the preload build.

const electronAPI = Object.freeze({
  openFile: () => ipcRenderer.invoke(IPC_CHANNELS.OPEN_FILE),
  saveFile: (payload) => ipcRenderer.invoke(IPC_CHANNELS.SAVE_FILE, payload),
  logger: Object.freeze({
    log: (payload) => ipcRenderer.send(IPC_CHANNELS.LOGGER_LOG, payload),
    openDir: () => ipcRenderer.invoke(IPC_CHANNELS.LOGGER_OPEN_DIR),
  }),
  vfs: Object.freeze({
    initWorkspace: (rootPath) => ipcRenderer.invoke(IPC_CHANNELS.VFS_INIT, rootPath),
    createFile: (payload) => ipcRenderer.invoke(IPC_CHANNELS.VFS_CREATE_FILE, payload),
    createFolder: (payload) => ipcRenderer.invoke(IPC_CHANNELS.VFS_CREATE_FOLDER, payload),
    renameNode: (payload) => ipcRenderer.invoke(IPC_CHANNELS.VFS_RENAME_NODE, payload),
    readContent: (contentId) => ipcRenderer.invoke(IPC_CHANNELS.VFS_READ_CONTENT, contentId),
    writeContent: (payload) => ipcRenderer.invoke(IPC_CHANNELS.VFS_WRITE_CONTENT, payload),
    showNoteInFolder: (nodeId) => ipcRenderer.invoke(IPC_CHANNELS.VFS_SHOW_NOTE_IN_FOLDER, nodeId),
    deleteNode: (nodeId) => ipcRenderer.invoke(IPC_CHANNELS.VFS_DELETE_NODE, nodeId),
    toggleNodeLock: (payload) => ipcRenderer.invoke(IPC_CHANNELS.VFS_TOGGLE_NODE_LOCK, payload),
  }),
  workspace: Object.freeze({
    showContextMenu: (payload) => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_SHOW_CONTEXT_MENU, payload),
  }),
  menu: Object.freeze({
    onOpenPreferences: (callback) => {
      const subscription = (_event) => callback();
      ipcRenderer.on(IPC_CHANNELS.MENU_OPEN_PREFERENCES, subscription);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.MENU_OPEN_PREFERENCES, subscription);
    }
  }),
  settings: Object.freeze({
    getConfig: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_LOAD),
    saveConfig: (config) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SAVE, config),
    setStartup: (enabled) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET_STARTUP, enabled),
    switchLanguage: (locale) => ipcRenderer.send(IPC_CHANNELS.APP_SWITHC_LANGUAGE, locale),
  }),
  aiSource: Object.freeze({
    testConnection: (config) => ipcRenderer.invoke(IPC_CHANNELS.AI_SOURCE_TEST_CONNECTION, config),
  }),
  aiAssistant: Object.freeze({
    complete: (payload) => ipcRenderer.invoke(IPC_CHANNELS.AI_ASSISTANT_COMPLETE, payload),
  }),
});

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
