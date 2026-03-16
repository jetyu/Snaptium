import { contextBridge, ipcRenderer } from 'electron';

const channels = {
  OPEN_FILE: 'editor:open-file',
  SAVE_FILE: 'editor:save-file',
};

const electronAPI = Object.freeze({
  openFile: () => ipcRenderer.invoke(channels.OPEN_FILE),
  saveFile: (payload) => ipcRenderer.invoke(channels.SAVE_FILE, payload),
});

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
