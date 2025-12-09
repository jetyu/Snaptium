/**
 * Preferences IPC 服务层
 * 封装所有与主进程的 IPC 通信
 */
import { IPC_CHANNELS } from '../constants.js';

export class PreferencesService {
  constructor(ipcRenderer) {
    if (!ipcRenderer) {
      throw new Error('ipcRenderer is required');
    }
    this.ipc = ipcRenderer;
  }

  /**
   * 获取单个配置项
   * @param {string} key - 配置键
   * @param {*} defaultValue - 默认值
   * @returns {Promise<*>}
   */
  async get(key, defaultValue = null) {
    try {
      return await this.ipc.invoke(IPC_CHANNELS.PREFERENCES_GET, key, defaultValue);
    } catch (error) {
      console.error(`[PreferencesService] Failed to get preference "${key}":`, error);
      return defaultValue;
    }
  }

  /**
   * 设置单个配置项
   * @param {string} key - 配置键
   * @param {*} value - 配置值
   * @returns {Promise<boolean>}
   */
  async set(key, value) {
    try {
      return await this.ipc.invoke(IPC_CHANNELS.PREFERENCES_SET, key, value);
    } catch (error) {
      console.error(`[PreferencesService] Failed to set preference "${key}":`, error);
      return false;
    }
  }

  /**
   * 获取所有配置
   * @returns {Promise<Object>}
   */
  async getAll() {
    try {
      return await this.ipc.invoke(IPC_CHANNELS.PREFERENCES_GET_ALL);
    } catch (error) {
      console.error('[PreferencesService] Failed to get all preferences:', error);
      return {};
    }
  }

  /**
   * 保存所有配置
   * @param {Object} preferences - 配置对象
   * @returns {Promise<boolean>}
   */
  async saveAll(preferences) {
    try {
      return await this.ipc.invoke(IPC_CHANNELS.PREFERENCES_SAVE_ALL, preferences);
    } catch (error) {
      console.error('[PreferencesService] Failed to save all preferences:', error);
      return false;
    }
  }

  /**
   * 导出配置到文件
   * @param {Object} preferences - 要导出的配置
   * @returns {Promise<Object>} { success, filePath?, error? }
   */
  async exportPreferences(preferences) {
    try {
      return await this.ipc.invoke(IPC_CHANNELS.EXPORT_PREFERENCES, preferences);
    } catch (error) {
      console.error('[PreferencesService] Failed to export preferences:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 从文件导入配置
   * @returns {Promise<Object>} { success, preferences?, error? }
   */
  async importPreferences() {
    try {
      return await this.ipc.invoke(IPC_CHANNELS.IMPORT_PREFERENCES);
    } catch (error) {
      console.error('[PreferencesService] Failed to import preferences:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取默认保存路径
   * @returns {Promise<string>}
   */
  async getDefaultSavePath() {
    try {
      return await this.ipc.invoke(IPC_CHANNELS.GET_DEFAULT_SAVE_PATH);
    } catch (error) {
      console.error('[PreferencesService] Failed to get default save path:', error);
      return '';
    }
  }

  /**
   * 选择目录
   * @param {string} currentPath - 当前路径
   * @returns {Promise<string|null>}
   */
  async selectDirectory(currentPath) {
    try {
      return await this.ipc.invoke(IPC_CHANNELS.SELECT_DIRECTORY, currentPath);
    } catch (error) {
      console.error('[PreferencesService] Failed to select directory:', error);
      return null;
    }
  }

  /**
   * 确保目录存在
   * @param {string} path - 目录路径
   * @returns {Promise<Object>} { success, error? }
   */
  async ensureDirectoryExists(path) {
    try {
      return await this.ipc.invoke(IPC_CHANNELS.ENSURE_DIRECTORY_EXISTS, path);
    } catch (error) {
      console.error('[PreferencesService] Failed to ensure directory exists:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 重启应用
   * @returns {Promise<void>}
   */
  async relaunchApp() {
    try {
      await this.ipc.invoke(IPC_CHANNELS.RELAUNCH_APP);
    } catch (error) {
      console.error('[PreferencesService] Failed to relaunch app:', error);
      throw error;
    }
  }

  /**
   * 获取开机自启状态
   * @returns {Promise<Object>} { success, enabled? }
   */
  async getStartupEnabled() {
    try {
      return await this.ipc.invoke(IPC_CHANNELS.GET_STARTUP_ENABLED);
    } catch (error) {
      console.error('[PreferencesService] Failed to get startup enabled:', error);
      return { success: false };
    }
  }

  /**
   * 设置开机自启
   * @param {boolean} enabled - 是否启用
   * @returns {Promise<Object>} { success, error? }
   */
  async setStartupEnabled(enabled) {
    try {
      return await this.ipc.invoke(IPC_CHANNELS.SET_STARTUP_ENABLED, enabled);
    } catch (error) {
      console.error('[PreferencesService] Failed to set startup enabled:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 切换自动更新检查
   * @param {boolean} enabled - 是否启用
   * @returns {Promise<Object>} { success, error? }
   */
  async toggleAutoUpdate(enabled) {
    try {
      return await this.ipc.invoke('auto-update:toggle', enabled);
    } catch (error) {
      console.error('[PreferencesService] Failed to toggle auto-update:', error);
      return { success: false, error: error.message };
    }
  }
}

/**
 * 创建 PreferencesService 实例
 * @param {Object} ipcRenderer - IPC 渲染进程对象
 * @returns {PreferencesService}
 */
export function createPreferencesService(ipcRenderer) {
  return new PreferencesService(ipcRenderer);
}
