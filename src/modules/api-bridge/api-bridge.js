/**
 * API 桥接模块
 * 负责注册通用的 Node.js 和 Electron API 的 IPC 处理器
 * 这些是纯粹的 API 转发，没有业务逻辑
 */

/**
 * 注册所有通用 API 桥接
 * @param {Object} deps - 依赖注入
 * @param {Object} deps.ipcMain - IPC 主进程模块
 * @param {Object} deps.app - Electron app 实例
 * @param {Object} deps.dialog - Electron dialog 模块
 * @param {Object} deps.shell - Electron shell 模块
 * @param {Object} deps.fs - 文件系统模块
 * @param {Object} deps.path - 路径模块
 * @param {Object} deps.os - 操作系统模块
 * @param {Object} deps.require - require 函数
 * @param {Function} deps.getWindow - 获取主窗口函数
 * @param {Object} deps.logger - 日志模块
 */
export function registerApiBridge(deps) {
  const { ipcMain, app, dialog, shell, fs, path, os, require, getWindow, logger } = deps;

  // ==================== 对话框 API ====================
  ipcMain.handle("dialog:showOpenDialog", async (_event, options) => {
    const win = getWindow();
    return await dialog.showOpenDialog(win, options);
  });

  ipcMain.handle("dialog:showSaveDialog", async (_event, options) => {
    const win = getWindow();
    return await dialog.showSaveDialog(win, options);
  });

  ipcMain.handle("dialog:showMessageBox", async (_event, options) => {
    const win = getWindow();
    return await dialog.showMessageBox(win, options);
  });

  // ==================== 应用程序 API ====================
  ipcMain.handle("app:getPath", (_event, name) => app.getPath(name));
  ipcMain.handle("app:getAppPath", () => app.getAppPath());
  ipcMain.handle("app:getVersion", () => app.getVersion());
  ipcMain.handle("app:openPath", (_event, targetPath) => shell.openPath(targetPath));
  ipcMain.handle("app:showItemInFolder", (_event, targetPath) => shell.showItemInFolder(targetPath));

  // ==================== 通用工具 API ====================

  // 基础 API
  ipcMain.handle('api:ping', () => {
    logger?.debug('Ping received');
    return 'pong';
  });

  // 获取用户数据路径
  ipcMain.handle("get-user-data-path", () => {
    logger?.debug('get-user-data-path received');
    return app.getPath("userData");
  });

  // 重启应用
  ipcMain.handle("relaunch-app", () => {
    logger?.debug('relaunch-app received');
    app.relaunch();
    app.exit(0);
    return true;
  });

  // 获取版本信息
  ipcMain.on("request-versions", (event) => {
    logger?.debug('request-versions received');
    const packageInfo = require("./package.json");
    event.sender.send("versions", {
      app: packageInfo.version,
      electron: process.versions.electron,
      node: process.versions.node,
      v8: process.versions.v8,
      chrome: process.versions.chrome,
      author: packageInfo.author,
      license: packageInfo.license,
    });
  });

  // 确保目录存在
  ipcMain.handle("ensure-directory-exists", (_event, dirPath) => {
    logger?.debug('ensure-directory-exists received');
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      logger?.debug('Directory exists');
      return { success: true };
    } catch (error) {
      logger?.error('Failed to ensure directory exists', error);
      return { success: false, error: error.message };
    }
  });

  // 获取默认笔记保存路径
  ipcMain.handle("get-default-save-path", () => {
    const appName = 'NoteWizard';
    const homeDir = os.homedir();

    if (process.platform === 'win32') {
      logger?.debug('Windows platform detected');
      return path.join(homeDir, 'Documents', appName);
    }
    if (process.platform === 'darwin') {
      logger?.debug('macOS platform detected');
      return path.join(homeDir, 'Library', 'Application Support', appName);
    }
    logger?.debug('other OS platform detected');
    return path.join(homeDir, `.${appName}`);
  });
}
