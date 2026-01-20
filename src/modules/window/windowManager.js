/**
 * 窗口管理模块
 * 负责主窗口的创建、配置和生命周期管理
 */

/**
 * 创建窗口管理器
 * @param {Object} deps - 依赖注入
 * @param {Object} deps.BrowserWindow - Electron BrowserWindow 类
 * @param {Object} deps.Menu - Electron Menu 类
 * @param {Object} deps.app - Electron app 实例
 * @param {Object} deps.path - 路径模块
 * @param {Object} deps.ipcMain - IPC 主进程模块
 * @param {string} deps.__dirname - 应用根目录
 * @returns {Object} 窗口管理器实例
 */
export function createWindowManager(deps) {
  const { BrowserWindow, Menu, app, path, ipcMain, __dirname } = deps;
  
  let mainWindow = null;

  /**
   * 获取应用图标路径
   * @returns {string} 图标文件路径
   */
  function getIconPath() {
    const iconFileName = process.platform === "win32"
      ? "app-logo.ico"
      : "app-logo-512.png";
    
    return path.join(__dirname, "src", "assets", "logo", iconFileName);
  }

  /**
   * 设置窗口事件监听
   */
  function setupWindowEvents() {
    if (!mainWindow) return;

    // 拦截窗口关闭事件，改为隐藏窗口（非 macOS）
    mainWindow.on("close", (e) => {
      if (process.platform !== "darwin") {
        e.preventDefault();
        mainWindow.hide();
        return false;
      }
      return true;
    });

    // 当所有窗口都关闭时，不退出应用（非 macOS）
    app.on("window-all-closed", (e) => {
      if (process.platform !== "darwin") {
        e.preventDefault();
      }
    });
  }

  /**
   * 设置预览面板状态监听
   */
  function setupPreviewStateListener() {
    if (!ipcMain) return;

    // 移除旧的监听器，避免重复注册
    ipcMain.removeAllListeners("preview-state-changed");
    
    ipcMain.on("preview-state-changed", (event, payload) => {
      const { visible } = payload || {};
      const currentMenu = Menu.getApplicationMenu();
      
      if (!currentMenu) return;
      
      const openItem = currentMenu.getMenuItemById("preview-open");
      const closeItem = currentMenu.getMenuItemById("preview-close");
      
      if (openItem && closeItem) {
        openItem.enabled = !visible;
        closeItem.enabled = !!visible;
      }
    });
  }

  /**
   * 创建主窗口
   * @returns {BrowserWindow} 主窗口实例
   */
  function createMainWindow() {
    const iconPath = getIconPath();

    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 1200,
      minHeight: 800,
      icon: iconPath,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        preload: path.join(__dirname, 'preload.js'),
        webSecurity: true,
        allowRunningInsecureContent: false,
        experimentalFeatures: false
      },
    });

    // 设置窗口标题
    mainWindow.setTitle("NoteWizard");
    
    // 加载主页面
    mainWindow.loadFile("src/index.html");

    // 开发环境下打开开发者工具
    if (process.env.NODE_ENV === 'development') {
      mainWindow.webContents.openDevTools();
    }

    // 设置窗口事件
    setupWindowEvents();
    
    // 设置预览面板状态监听
    setupPreviewStateListener();

    return mainWindow;
  }

  /**
   * 获取主窗口实例
   * @returns {BrowserWindow|null} 主窗口实例
   */
  function getMainWindow() {
    return mainWindow;
  }

  /**
   * 显示主窗口
   */
  function showMainWindow() {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
      mainWindow.focus();
    }
  }

  /**
   * 隐藏主窗口
   */
  function hideMainWindow() {
    if (mainWindow) {
      mainWindow.hide();
    }
  }

  /**
   * 切换主窗口显示/隐藏
   */
  function toggleMainWindow() {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        hideMainWindow();
      } else {
        showMainWindow();
      }
    }
  }

  /**
   * 关闭所有窗口并退出应用
   */
  function closeAllWindows() {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((win) => {
      win.removeAllListeners("close");
      win.close();
    });
  }

  return {
    createMainWindow,
    getMainWindow,
    getIconPath,
    showMainWindow,
    hideMainWindow,
    toggleMainWindow,
    closeAllWindows
  };
}
