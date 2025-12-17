import { contextBridge, ipcRenderer, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

contextBridge.exposeInMainWorld('electronAPI', {
    fs: {
        readFile: (filePath, encoding) => fs.promises.readFile(filePath, encoding),
        writeFile: (filePath, content, options = {}) => fs.promises.writeFile(filePath, content, options),
        readdir: (dirPath, options = {}) => fs.promises.readdir(dirPath, options),
        mkdir: (dirPath, options = {}) => fs.promises.mkdir(dirPath, options),
        stat: (targetPath) => fs.promises.stat(targetPath),
        unlink: (targetPath) => fs.promises.unlink(targetPath),
        rmdir: (targetPath) => fs.promises.rm(targetPath, { recursive: true, force: true }),
        exists: async (targetPath) => {
            try {
                await fs.promises.access(targetPath, fs.constants.F_OK);
                return true;
            } catch {
                return false;
            }
        },
        rename: (oldPath, newPath) => fs.promises.rename(oldPath, newPath),
        readFileSync: (targetPath, encoding) => fs.readFileSync(targetPath, encoding),
        writeFileSync: (targetPath, data, options) => fs.writeFileSync(targetPath, data, options),
        existsSync: (targetPath) => fs.existsSync(targetPath),
        mkdirSync: (targetPath, options) => fs.mkdirSync(targetPath, options),
        renameSync: (oldPath, newPath) => fs.renameSync(oldPath, newPath),
        unlinkSync: (targetPath) => fs.unlinkSync(targetPath),
        rmSync: (targetPath, options) => fs.rmSync(targetPath, options),
        readdirSync: (dirPath, options) => fs.readdirSync(dirPath, options),
        statSync: (targetPath) => fs.statSync(targetPath)
    },

    path: {
        join: (...args) => path.join(...args),
        dirname: (p) => path.dirname(p),
        basename: (p, ext) => path.basename(p, ext),
        extname: (p) => path.extname(p),
        normalize: (p) => path.normalize(p),
        resolve: (...args) => path.resolve(...args),
        sep: path.sep
    },

    os: {
        homedir: () => os.homedir(),
        platform: () => os.platform(),
        arch: () => os.arch()
    },

    shell: {
        openPath: (targetPath) => shell.openPath(targetPath),
        showItemInFolder: (targetPath) => shell.showItemInFolder(targetPath)
    },

    ipcRenderer: {
        send: (channel, ...args) => ipcRenderer.send(channel, ...args),
        on: (channel, listener) => {
            const subscription = (event, ...args) => {
                const invoke = () => {
                    try {
                        listener(event, ...args);
                    } catch (error) {
                        console.warn(`[preload] listener for ${channel} threw`, error);
                    }
                };

                if (document.readyState === 'loading') {
                    const runOnce = () => {
                        document.removeEventListener('DOMContentLoaded', runOnce);
                        invoke();
                    };
                    document.addEventListener('DOMContentLoaded', runOnce, { once: true });
                } else {
                    invoke();
                }
            };
            ipcRenderer.on(channel, subscription);
            return () => ipcRenderer.removeListener(channel, subscription);
        },
        once: (channel, listener) => ipcRenderer.once(channel, (event, ...args) => {
            const invoke = () => {
                try {
                    listener(event, ...args);
                } catch (error) {
                    console.warn(`[preload] listener for ${channel} threw`, error);
                }
            };

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', invoke, { once: true });
            } else {
                invoke();
            }
        }),
        removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
        invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args)
    },

    dialog: {
        showOpenDialog: (options) => ipcRenderer.invoke('dialog:showOpenDialog', options),
        showSaveDialog: (options) => ipcRenderer.invoke('dialog:showSaveDialog', options),
        showMessageBox: (options) => ipcRenderer.invoke('dialog:showMessageBox', options)
    },

    images: {
        saveImageFromPaste: (payload) => ipcRenderer.invoke('images:save-paste', payload)
    },

    app: {
        getPath: (name) => ipcRenderer.invoke('app:getPath', name),
        getAppPath: () => ipcRenderer.invoke('app:getAppPath'),
        getVersion: () => ipcRenderer.invoke('app:getVersion'),
        openPath: (filePath) => ipcRenderer.invoke('app:openPath', filePath),
        showItemInFolder: (filePath) => ipcRenderer.invoke('app:showItemInFolder', filePath)
    },

    contextMenu: {
        show: (menuItems, callback) => {
            const channel = `context-menu-${Date.now()}`;
            ipcRenderer.once(channel, (event, action) => {
                callback(action);
            });
            ipcRenderer.send('context-menu:show', { menuItems, channel });
        }
    }
});

document.addEventListener('DOMContentLoaded', () => {
});
