/**
 * 开机启动管理模块
 * 负责管理应用的开机自启动设置
 */

/**
 * 创建开机启动管理器
 * @param {Object} deps - 依赖注入
 * @param {Object} deps.app - Electron app 实例
 * @param {Object} deps.ipcMain - IPC 主进程模块
 * @returns {Object} 开机启动管理器实例
 */
export function createStartupManager(deps) {
  const { app, ipcMain, logger } = deps;

  /**
   * 获取当前开机启动状态
   * @returns {Object} 包含 success 和 enabled 的对象
   */
  function getStartupEnabled() {
    try {
      const settings = app.getLoginItemSettings();
      return { success: true, enabled: !!settings.openAtLogin };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 设置开机启动
   * @param {boolean} enabled - 是否启用开机启动
   * @returns {Object} 包含 success 和 enabled 的对象
   */
  function setStartupEnabled(enabled) {
    try {
      const options = {
        openAtLogin: !!enabled,
        openAsHidden: true,
      };
      
      // 在 Windows 上显式设置路径以确保使用正确的可执行文件
      if (process.platform === "win32") {
        options.path = process.execPath;
      }
      
      app.setLoginItemSettings(options);
      return { success: true, enabled: !!enabled };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 注册 IPC 处理器
   */
  function registerIpcHandlers() {
    // 查询当前开机启动设置
    ipcMain.handle("get-startup-enabled", () => {
      logger?.debug('IPC received: get-startup-enabled');
      return getStartupEnabled();
    });

    // 设置开机启动
    ipcMain.handle("set-startup-enabled", (event, enabled) => {
      logger?.debug('IPC received: set-startup-enabled');
      return setStartupEnabled(enabled);
    });
  }

  // 自动注册 IPC 处理器
  if (ipcMain) {
    registerIpcHandlers();
  }

  return {
    getStartupEnabled,
    setStartupEnabled
  };
}
