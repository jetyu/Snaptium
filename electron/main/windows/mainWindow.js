import { BrowserWindow } from 'electron';
import path from 'node:path';

export function secureWebContents(win, isDev) {
  const wc = win.webContents;

  // 禁止新窗口
  wc.setWindowOpenHandler(({ url }) => {
    // 白名单，允许打开特定外部链接
    const allowed = ['https://github.com'];

    if (allowed.some(domain => url.startsWith(domain))) {
      require('electron').shell.openExternal(url);
    }
    // 禁止打开新窗口
    return { action: 'deny' };
  });

  // 禁止非法跳转
  wc.on('will-navigate', (e, url) => {
    const allowedPrefixes = isDev
      ? ['http://127.0.0.1:5173'] // 开发环境允许访问开发服务器
      : ['file://']; // 生产环境只允许本地文件访问

    const isAllowed = allowedPrefixes.some(prefix => url.startsWith(prefix));

    if (!isAllowed) {
      e.preventDefault(); // 如果跳转到不允许的地址，则阻止跳转
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
      devTools: isDev,          // 开发环境启用开发者工具
      contextIsolation: true,   // 开启上下文隔离
      nodeIntegration: false,   // 禁止 renderer 直接使用 Node.js API
      sandbox: true,           // 禁用 sandbox 以支持 ES 模块 preload
      spellcheck: false,        // 禁用拼写检查
    },
  });

  // 在窗口准备好显示时显示窗口
  mainWindow.once('ready-to-show', () => mainWindow.show());

  // 根据开发环境选择加载内容
  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5173'); // 开发模式加载本地服务器
  } else {
    mainWindow.loadFile(path.join(appPath, 'dist/renderer/index.html')); // 生产模式加载构建后的文件
  }

  // 安全设置：调用上述统一方法
  secureWebContents(mainWindow, isDev);

  return mainWindow;
}