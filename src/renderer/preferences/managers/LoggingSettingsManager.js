/**
 * 日志设置管理器
 * 负责日志开启/关闭和日志级别设置
 */
import { SELECTORS, DEFAULTS } from '../constants.js';

export class LoggingSettingsManager {
  constructor(deps) {
    this.prefsService = deps.prefsService;
    this.i18n = deps.i18n;
    this.modal = deps.modal;
    this.isInitialized = false;
  }

  /**
   * 初始化
   */
  async init() {
    if (this.isInitialized) return;
    this.isInitialized = true;
  }

  /**
   * 加载到 UI
   */
  async loadSettings() {
    const modalElement = this.modal.getModal();
    if (!modalElement) return;

    const loggingEnabledCheckbox = modalElement.querySelector(SELECTORS.LOGGING_ENABLED_INPUT);
    const loggingLevelSelect = modalElement.querySelector(SELECTORS.LOGGING_LEVEL_SELECT);

    if (!loggingEnabledCheckbox || !loggingLevelSelect) return;

    try {
      const settings = await this.prefsService.get('loggingSettings', DEFAULTS.LOGGING_SETTINGS);
      loggingEnabledCheckbox.checked = !!settings.enabled;
      loggingLevelSelect.value = settings.level || DEFAULTS.LOGGING_SETTINGS.level;
      
      // 强制更新翻译（防止异步加载导致的选择框选项未翻译）
      if (typeof this.i18n?.applyI18n === 'function') {
        this.i18n.applyI18n();
      }
    } catch (error) {
      console.error('[LoggingSettingsManager] Failed to load logging settings:', error);
    }
  }

  /**
   * 绑定事件
   */
  bindEvents() {
    const modalElement = this.modal.getModal();
    if (!modalElement) return;

    const loggingEnabledCheckbox = modalElement.querySelector(SELECTORS.LOGGING_ENABLED_INPUT);
    const loggingLevelSelect = modalElement.querySelector(SELECTORS.LOGGING_LEVEL_SELECT);

    if (loggingEnabledCheckbox) {
      loggingEnabledCheckbox.addEventListener('change', async () => {
        await this.saveSettings();
      });
    }

    if (loggingLevelSelect) {
      loggingLevelSelect.addEventListener('change', async () => {
        await this.saveSettings();
      });
    }
  }

  /**
   * 保存设置
   */
  async saveSettings() {
    const modalElement = this.modal.getModal();
    if (!modalElement) return;

    const loggingEnabledCheckbox = modalElement.querySelector(SELECTORS.LOGGING_ENABLED_INPUT);
    const loggingLevelSelect = modalElement.querySelector(SELECTORS.LOGGING_LEVEL_SELECT);

    const settings = {
      enabled: !!loggingEnabledCheckbox.checked,
      level: loggingLevelSelect.value
    };

    try {
      await this.prefsService.set('loggingSettings', settings);
      
      // 通知主进程更新日志配置
      if (window.electronAPI?.ipcRenderer) {
        await window.electronAPI.ipcRenderer.invoke('logger:update-config', settings);
      }
    } catch (error) {
      console.error('[LoggingSettingsManager] Failed to save logging settings:', error);
    }
  }

  /**
   * 重置
   */
  async reset() {
    await this.prefsService.set('loggingSettings', DEFAULTS.LOGGING_SETTINGS);
    await this.loadSettings();
    
    // 通知主进程
    if (window.electronAPI?.ipcRenderer) {
      await window.electronAPI.ipcRenderer.invoke('logger:update-config', DEFAULTS.LOGGING_SETTINGS);
    }
  }
}
