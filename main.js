import { app, BrowserWindow, Menu, Tray, nativeImage, dialog, ipcMain, shell } from "electron";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

// 导入模块
import { createI18nManager } from "./src/modules/i18n/i18n-ipc.js";
import { createPreferencesManager } from "./src/modules/preferences/preferences-ipc.js";
import { createStartupManager } from "./src/modules/startup/startup-ipc.js";
import { createImagesManager } from "./src/modules/images/images-ipc.js";
import { createWindowManager } from "./src/modules/window/windowManager.js";
import { createMenuManager } from "./src/modules/menu/menuManager.js";
import { createTrayManager } from "./src/modules/tray/trayManager.js";
import { createAutoUpdaterManager } from "./src/modules/updater/auto-updater.js";
import { createImportExportManager } from "./src/modules/import-export/import-export-ipc.js";
import { createEncryptionManager } from "./src/modules/encryption/encryption-ipc.js";
import { registerApiBridge } from "./src/modules/api-bridge/api-bridge.js";
import { createLoggerManager } from "./src/modules/logger/index.js";

const require = createRequire(import.meta.url);
const AdmZip = require('adm-zip');
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RELEASE_PAGE_URL = "https://github.com/jetyu/NoteWizard/releases";

// ==================== 应用配置 ====================

// 启用详细警告跟踪和日志记录
process.traceProcessWarnings = true;

// 启用 Chromium 的详细日志
app.commandLine.appendSwitch('enable-logging');
app.commandLine.appendSwitch('log-level', '0');

// 在应用启动前设置应用名称
app.setName("NoteWizard");
if (process.platform === "win32") {
  app.setAppUserModelId("com.app.notewizard");
}

// ==================== 管理器实例 ====================
const managers = {};

// ==================== 单实例锁定 ====================
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  // 当第二个实例启动时，恢复已有窗口
  app.on("second-instance", () => {
    const win = managers.window?.getMainWindow();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });
}

// ==================== 全局翻译函数 ====================
/**
 * 全局翻译函数
 * @param {string} key - 翻译键
 * @returns {string} 翻译后的文本
 */
const t = (key) => managers.i18n ? managers.i18n.t(key) : key;
global.t = t;

// ==================== 初始化管理器 ====================
function initializeManagers() {
  // 0. 创建日志管理器
  managers.logger = createLoggerManager({
    app,
    dialog,
    shell,
    AdmZip,
    appLoggerCategory: "LogManager-Box"
  });

  // 0. 注册通用 API 桥接
  registerApiBridge({
    ipcMain,
    app,
    dialog,
    shell,
    fs,
    path,
    os,
    require,
    getWindow: () => managers.window?.getMainWindow(),
    logger: managers.logger.createLogger("APIsBridge-Box")
  });

  // 1. 创建配置管理器
  managers.preferences = createPreferencesManager({
    app,
    fs,
    path,
    ipcMain,
    dialog,
    t,
    logger: managers.logger.createLogger("Preference-Box")
  });

  // 2. 创建国际化管理器
  managers.i18n = createI18nManager({
    fs,
    path,
    ipcMain,
    localesDir: path.join(__dirname, "src", "locales"),
    getPreference: managers.preferences.getPreference,
    setPreference: managers.preferences.setPreference,
    logger: managers.logger.createLogger("AppLocales-Box"),
    onLanguageChanged: (lang) => {
      // 语言切换后的回调：重建菜单和托盘
      const iconPath = managers.window?.getIconPath();

      // 重建菜单
      if (managers.menu && iconPath) {
        managers.menu.createApplicationMenu(iconPath);
      }

      // 重建托盘
      if (managers.tray && process.platform !== "darwin") {
        managers.tray.destroyTray();
        managers.tray.createSystemTray();
      }

      // 更新应用名称
      const appName = t("appName");
      if (appName) {
        app.setName(appName);
      }
    }
  });

  // 初始化语言
  managers.i18n.initLanguage();

  // 初始化应用名称
  const appName = t("appName");
  if (appName) {
    app.setName(appName);
  }

  // 3. 创建开机启动管理器
  managers.startup = createStartupManager({
    app,
    ipcMain,
    logger: managers.logger.createLogger("AppStartup-Box")
  });

  // 4. 创建图片管理器
  managers.images = createImagesManager({
    fs,
    path,
    ipcMain,
    logger: managers.logger.createLogger("PasteImage-Box")
  });

  // 5. 创建窗口管理器
  managers.window = createWindowManager({
    BrowserWindow,
    Menu,
    app,
    path,
    ipcMain,
    __dirname,
    logger: managers.logger.createLogger("AppWindows-Box")
  });

  // 6. 创建更新管理器
  managers.updater = createAutoUpdaterManager({
    app,
    dialog,
    shell,
    t,
    getWindow: () => managers.window.getMainWindow(),
    releasePageUrl: RELEASE_PAGE_URL,
    currentVersion: app.getVersion(),
    logger: managers.logger.createLogger("AppUpdater-Box")
  });

  // 7. 创建导入导出管理器
  managers.importExport = createImportExportManager({
    app,
    dialog,
    ipcMain,
    getPreference: managers.preferences.getPreference,
    t,
    getWindow: () => managers.window.getMainWindow(),
    AdmZip,
    logger: managers.logger.createLogger("ImOrExport-Box")
  });

  // 8. 创建加密管理器
  managers.encryption = createEncryptionManager({
    ipcMain,
    preferencesManager: managers.preferences,
    app,
    getWindow: () => managers.window.getMainWindow(),
    logger: managers.logger.createLogger("Encryption-Box")
  });

  // 9. 创建菜单管理器
  managers.menu = createMenuManager({
    Menu,
    BrowserWindow,
    dialog,
    shell,
    fs,
    path,
    app,
    t,
    getWindow: () => managers.window.getMainWindow(),
    closeAllWindows: () => managers.window.closeAllWindows(),
    importExportManager: managers.importExport,
    handleManualUpdateCheck: async () => {
      await managers.updater.checkForUpdates();
    },
    loggerManager: managers.logger,
    __dirname
  });

  // 10. 创建托盘管理器
  managers.tray = createTrayManager({
    Tray,
    Menu,
    nativeImage,
    app,
    path,
    t,
    getWindow: () => managers.window.getMainWindow(),
    closeAllWindows: () => managers.window.closeAllWindows(),
    __dirname,
    logger: managers.logger.createLogger("WindowTray-Box")
  });

}

// ==================== 业务相关 IPC 处理器 ====================

// 处理保存请求
ipcMain.handle("save-file-content", async (event, { content, filePath }) => {
  const win = managers.window?.getMainWindow();
  if (!win) return { success: false, error: "Window not initialized" };

  try {
    let targetPath = filePath;
    if (!targetPath) {
      const { canceled, filePath: savePath } = await dialog.showSaveDialog(win, {
        filters: [{ name: "Markdown", extensions: ["md"] }],
      });
      if (canceled) return { success: false, error: "User canceled save" };
      targetPath = savePath;
    }

    // 确保目录存在
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    await fs.promises.writeFile(targetPath, content, "utf-8");
    return { success: true, filePath: targetPath };
  } catch (error) {
    managers.logger?.appLogger.error('Failed to save file: ' + error.message);
    return { success: false, error: error.message };
  }
});

// 处理目录选择对话框
ipcMain.handle("select-directory", async (event, defaultPath) => {
  const win = managers.window?.getMainWindow();
  if (!win) return null;

  const result = await dialog.showOpenDialog(win, {
    defaultPath: defaultPath || app.getPath("documents"),
    properties: ["openDirectory", "createDirectory"],
  });
  return result.canceled ? null : result.filePaths[0];
});

// 处理自动更新切换
ipcMain.handle("auto-update:toggle", async (event, enabled) => {
  try {
    if (enabled) {
      managers.logger?.appLogger.debug('Enabling auto-update checks');
      managers.updater.startAutoUpdateCheck();
    } else {
      managers.logger?.appLogger.debug('Disabling auto-update checks');
      managers.updater.stopAutoUpdateCheck();
    }
    return { success: true };
  } catch (error) {
    managers.logger?.appLogger.error('Failed to toggle auto-update: ' + error.message);
    return { success: false, error: error.message };
  }
});

// 处理右键菜单
ipcMain.on('context-menu:show', (event, { menuItems, channel }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;

  // 构建菜单模板
  const template = menuItems.map(item => {
    if (item.type === 'separator') {
      return { type: 'separator' };
    }

    return {
      label: item.label,
      enabled: item.enabled === undefined ? true : item.enabled, // 默认启用，除非明确设置为 false
      click: () => {
        // 将选中的操作发送回渲染进程
        event.sender.send(channel, item.action);
      }
    };
  });

  const contextMenu = Menu.buildFromTemplate(template);
  contextMenu.popup({ window: win });
});


// ==================== 应用启动 ====================
app.whenReady().then(() => {
  // 初始化所有管理器
  initializeManagers();

  // 创建主窗口
  managers.window.createMainWindow();

  // 创建应用菜单
  const iconPath = managers.window.getIconPath();
  managers.menu.createApplicationMenu(iconPath);

  // 创建系统托盘（在Windows和Linux上）
  if (process.platform !== "darwin") {
    managers.tray.createSystemTray();
  }

  // macOS 应用激活
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      managers.window.createMainWindow();
    } else {
      managers.window.showMainWindow();
    }
  });

  // 初始化自动更新检查
  (async () => {
    const autoUpdate = managers.preferences.getPreference('autoUpdate', true);
    if (autoUpdate) {
      managers.updater.startAutoUpdateCheck();
    } else {
      managers.logger?.appLogger.info('Auto-updater is disabled');
    }
  })();
});

// ==================== 应用事件 ====================

// 所有窗口关闭时退出应用 (macOS除外)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 应用即将退出
app.on('will-quit', (event) => {
  managers.logger?.appLogger.info('NoteWizard will quit');
  managers.logger?.destroy();
  // 可以在这里执行清理操作
});
