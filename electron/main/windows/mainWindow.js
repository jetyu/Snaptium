import { BrowserWindow } from 'electron';
import path from 'node:path';

export function secureWebContents(win, isDev) {
  const wc = win.webContents;

  wc.setWindowOpenHandler(({ url }) => {
    const allowed = ['https://github.com'];

    if (allowed.some(domain => url.startsWith(domain))) {
      require('electron').shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  wc.on('will-navigate', (e, url) => {
    const allowedPrefixes = isDev
      ? ['http://127.0.0.1:5173'] 
      : ['file://']; 

    const isAllowed = allowedPrefixes.some(prefix => url.startsWith(prefix));

    if (!isAllowed) {
      e.preventDefault(); 
    }
  });
}

export function createMainWindow({ isDev, appPath }) {
  const mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 960,
    minHeight: 680,
    show: false,
    title: 'Pilotra',
    webPreferences: {
      preload: path.join(appPath, 'electron/preload/index.js'),
      devTools: isDev,         
      contextIsolation: true,  
      nodeIntegration: false,   
      sandbox: true,          
      spellcheck: false,       
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5173'); 
  } else {
    mainWindow.loadFile(path.join(appPath, 'dist/renderer/index.html'));
  }

  secureWebContents(mainWindow, isDev);

  return mainWindow;
}