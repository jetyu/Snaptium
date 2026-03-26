/**
 * 系统托盘管理模块
 * 负责系统托盘图标和菜单的创建与管理
 */

/**
 * 创建托盘管理器
 * @param {Object} deps - 依赖注入
 * @param {Object} deps.Tray - Electron Tray 类
 * @param {Object} deps.Menu - Electron Menu 类
 * @param {Object} deps.nativeImage - Electron nativeImage 模块
 * @param {Object} deps.app - Electron app 实例
 * @param {Object} deps.path - 路径模块
 * @param {Function} deps.t - 国际化翻译函数
 * @param {Function} deps.getWindow - 获取主窗口函数
 * @param {Function} deps.closeAllWindows - 关闭所有窗口函数
 * @param {string} deps.__dirname - 应用根目录
 * @returns {Object} 托盘管理器实例
 */
export function createTrayManager(deps) {
  const { Tray, Menu, nativeImage, app, path, t, getWindow, closeAllWindows, __dirname, logger } = deps;

  let tray = null;

  /**
   * 获取托盘图标路径
   * @returns {string} 图标文件路径
   */
  function getTrayIconPath() {
    const iconFileName = process.platform === "win32"
      ? "app-logo.ico"
      : "app-logo-512.png";

    return path.join(__dirname, "src", "assets", "logo", iconFileName);
  }

  /**
   * 创建托盘图标
   * @param {string} iconPath - 图标路径
   * @returns {NativeImage} 托盘图标
   */
  function createTrayIcon(iconPath) {
    let trayIcon = nativeImage.createFromPath(iconPath);

    // 调整图标大小
    if (process.platform === "win32") {
      trayIcon = trayIcon.resize({ width: 32, height: 32 });
    } else {
      trayIcon = trayIcon.resize({ width: 32, height: 32 });
    }

    return trayIcon;
  }

  /**
   * 构建托盘菜单
   * @returns {Menu} 托盘菜单
   */
  function buildTrayMenu() {
    return Menu.buildFromTemplate([
      {
        label: t("tray.open"),
        click: () => {
          const win = getWindow();
          if (win) {
            if (win.isMinimized()) win.restore();
            win.show();
            win.focus();
          }
        },
      },
      { type: "separator" },
      {
        label: t("tray.quit"),
        click: () => {
          // 关闭所有窗口
          if (closeAllWindows) {
            closeAllWindows();
            logger.info("All windows closed");
          } else {
            const { BrowserWindow } = require('electron');
            const windows = BrowserWindow.getAllWindows();
            windows.forEach((win) => {
              win.removeAllListeners("close");
              win.close();
            });
          }
          logger.info("App quit");
          // 完全退出应用
          app.exit(0);
        },
      },
    ]);
  }

  /**
   * 设置托盘事件监听
   */
  function setupTrayEvents() {
    if (!tray) return;

    // 点击托盘图标时切换窗口显示/隐藏
    tray.on("click", () => {
      const win = getWindow();
      if (win) {
        if (win.isVisible()) {
          win.hide();
        } else {
          if (win.isMinimized()) win.restore();
          win.show();
          win.focus();
        }
      }
    });
  }

  /**
   * 创建系统托盘
   * @returns {Tray} 托盘实例
   */
  function createSystemTray() {
    const iconPath = getTrayIconPath();
    const trayIcon = createTrayIcon(iconPath);

    tray = new Tray(trayIcon);
    tray.setToolTip("NoteWizard");
    tray.setContextMenu(buildTrayMenu());

    setupTrayEvents();

    return tray;
  }

  /**
   * 更新托盘菜单（用于语言切换后重建）
   */
  function updateTrayMenu() {
    if (tray) {
      tray.setContextMenu(buildTrayMenu());
    }
  }

  /**
   * 销毁托盘
   */
  function destroyTray() {
    if (tray) {
      tray.destroy();
      tray = null;
    }
  }

  /**
   * 获取托盘实例
   * @returns {Tray|null} 托盘实例
   */
  function getTray() {
    return tray;
  }

  return {
    createSystemTray,
    updateTrayMenu,
    destroyTray,
    getTray
  };
}
