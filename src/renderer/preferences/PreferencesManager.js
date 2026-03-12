/**
 * Preferences 主管理器
 * 整合所有子管理器，提供统一的接口
 */
import { eventBus } from '../../utils/EventBus.js';
import { createPreferencesService } from './services/PreferencesService.js';
import { ModalController } from './ui/ModalController.js';
import { PaneController } from './ui/PaneController.js';
import { GeneralSettingsManager } from './managers/GeneralSettingsManager.js';
import { AppearanceSettingsManager } from './managers/AppearanceSettingsManager.js';
import { PathSettingsManager } from './managers/PathSettingsManager.js';
import { EncryptionSettingsManager } from './managers/EncryptionSettingsManager.js';
import { AISettingsManager } from './managers/AISettingsManager.js';
import { LoggingSettingsManager } from './managers/LoggingSettingsManager.js';
import { SELECTORS, DEFAULTS } from './constants.js';

export class PreferencesManager {
  constructor(deps) {
    // 依赖注入
    this.electronAPI = deps.electronAPI || window.electronAPI;
    this.i18n = deps.i18n;
    this.ipcRenderer = this.electronAPI.ipcRenderer;

    // 创建服务层
    this.prefsService = createPreferencesService(this.ipcRenderer);

    // 创建事件总线
    this.eventBus = eventBus;

    // 创建共享依赖对象
    const sharedDeps = {
      electronAPI: this.electronAPI,
      prefsService: this.prefsService,
      i18n: this.i18n,
      eventBus: this.eventBus,
    };

    // 创建 UI 控制器
    this.modal = new ModalController(sharedDeps);
    this.pane = new PaneController({ ...sharedDeps, modal: this.modal });

    // 创建设置管理器
    const managerDeps = { ...sharedDeps, modal: this.modal };
    this.general = new GeneralSettingsManager(managerDeps);
    this.appearance = new AppearanceSettingsManager(managerDeps);
    this.path = new PathSettingsManager(managerDeps);
    this.encryption = new EncryptionSettingsManager(managerDeps);
    this.ai = new AISettingsManager(managerDeps);
    this.logging = new LoggingSettingsManager(managerDeps);

    this.isInitialized = false;
  }

  /**
   * 初始化 Preferences
   */
  async init() {
    if (this.isInitialized) return;

    // 初始化各个管理器（加载设置并应用）
    await this.general.init();
    await this.appearance.init();

    // 监听 IPC 事件
    this.bindIPCEvents();

    // 初始化 UI（在 DOMContentLoaded 后）
    await this.initUI();

    // 设置快捷键
    this.setupKeyboardShortcuts();

    this.isInitialized = true;
  }

  /**
   * 初始化 UI
   */
  async initUI() {
    const initUITask = async () => {
      // 确保模态框存在
      await this.modal.ensureModalExists();

      // 初始化面板控制器
      this.pane.init();

      this.general.bindEvents();
      this.appearance.bindEvents();

      // 初始化需要 DOM 的管理器
      await this.path.init();
      await this.encryption.init();
      await this.ai.init();
      await this.logging.loadSettings();
      this.logging.bindEvents();

      // 绑定全局事件
      this.bindGlobalEvents();
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initUITask, { once: true });
    } else {
      await initUITask();
    }
  }

  /**
   * 绑定 IPC 事件
   */
  bindIPCEvents() {
    if (this.ipcRenderer) {
      this.ipcRenderer.on('open-preferences', () => {
        this.open();
      });
    }
  }

  /**
   * 绑定全局事件
   */
  bindGlobalEvents() {
    const modalElement = this.modal.getModal();
    if (!modalElement) return;

    // 绑定导出按钮
    this.bindExportButton(modalElement);

    // 绑定导入按钮
    this.bindImportButton(modalElement);

    // 绑定重置按钮
    this.bindResetButton(modalElement);

    // 监听模态框打开事件
    this.eventBus.on('modal:opened', async () => {
      await this.onModalOpened();
    });
  }

  /**
   * 绑定导出按钮
   */
  bindExportButton(modalElement) {
    const exportBtn = modalElement.querySelector(SELECTORS.EXPORT_BTN);
    if (!exportBtn) return;

    exportBtn.addEventListener('click', async () => {
      await this.exportPreferences();
    });
  }

  /**
   * 绑定导入按钮
   */
  bindImportButton(modalElement) {
    const importBtn = modalElement.querySelector(SELECTORS.IMPORT_BTN);
    if (!importBtn) return;

    importBtn.addEventListener('click', async () => {
      await this.importPreferences();
    });
  }

  /**
   * 绑定重置按钮
   */
  bindResetButton(modalElement) {
    const resetBtn = modalElement.querySelector(SELECTORS.RESET_BTN);
    if (!resetBtn) return;

    resetBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await this.resetAllSettings();
    });
  }

  /**
   * 模态框打开时的处理
   */
  async onModalOpened() {
    // 恢复上次激活的面板
    this.pane.restoreActivePane();

    // 加载所有设置到 UI
    await this.loadAllSettingsToUI();
  }

  /**
   * 加载所有设置到 UI
   */
  async loadAllSettingsToUI() {
    await Promise.all([
      this.general.loadToUI(),
      this.appearance.loadToUI(),
      this.path.loadSettings(),
      this.ai.loadSettings(),
      this.logging.loadSettings(),
    ]);
  }

  /**
   * 打开 Preferences 模态框
   */
  async open() {
    await this.modal.open();
  }

  /**
   * 关闭 Preferences 模态框
   */
  close() {
    this.modal.close();
  }

  /**
   * 导出首选项
   */
  async exportPreferences() {
    try {
      // 从 preferences 读取所有配置
      const allPrefs = await this.prefsService.getAll();

      const aiSettings = allPrefs.aiSettings || {};
      const completeAISettings = {
        enabled: aiSettings.enabled || false,
        model: aiSettings.model || '',
        apiKey: aiSettings.apiKey || '',
        endpoint: aiSettings.endpoint || '',
        systemPrompt: aiSettings.systemPrompt || '',
        typingDelay: aiSettings.typingDelay || DEFAULTS.AI_SETTINGS.typingDelay,
        minInputLength: aiSettings.minInputLength || DEFAULTS.AI_SETTINGS.minInputLength
      };

      // 收集所有首选项
      const preferences = {
        themeMode: allPrefs.themeMode || DEFAULTS.THEME_MODE,
        editorFontSize: allPrefs.editorFontSize || DEFAULTS.EDITOR_FONT_SIZE,
        editorFontFamily: allPrefs.editorFontFamily || DEFAULTS.EDITOR_FONT_FAMILY,
        previewFontSize: allPrefs.previewFontSize || DEFAULTS.PREVIEW_FONT_SIZE,
        previewFontFamily: allPrefs.previewFontFamily || DEFAULTS.PREVIEW_FONT_FAMILY,
        noteSavePath: allPrefs.noteSavePath || await this.prefsService.getDefaultSavePath(),
        language: allPrefs.language || DEFAULTS.LANGUAGE,
        aiSettings: completeAISettings,
        startupOnLogin: allPrefs.startupOnLogin || false,
        autoUpdate: allPrefs.autoUpdate !== undefined ? allPrefs.autoUpdate : true
      };

      // 调用主进程导出
      const result = await this.prefsService.exportPreferences(preferences);

      const statusElement = document.getElementById('status');
      if (result.success) {
        if (statusElement) {
          statusElement.textContent = this.t('exportSuccess') + result.filePath;
        }
      } else {
        if (statusElement) {
          statusElement.textContent = this.t('exportFailed') + (result.error || '');
        }
      }
    } catch (error) {
      console.error('[PreferencesManager] Export failed:', error);
      const statusElement = document.getElementById('status');
      if (statusElement) {
        statusElement.textContent = this.t('exportFailed') + (error.message || error);
      }
    }
  }

  /**
   * 导入首选项
   */
  async importPreferences() {
    try {
      // 显示确认对话框
      let confirmed = false;
      const electronAPI = window.electronAPI;
      
      if (electronAPI?.dialog?.showMessageBox) {
        const result = await electronAPI.dialog.showMessageBox({
          type: 'question',
          title: this.t('dialog.confirm'),
          message: this.t('importConfirm'),
          buttons: [this.t('dialog.ok'), this.t('dialog.cancel')],
          defaultId: 0,
          cancelId: 1,
          noLink: true
        });
        confirmed = result.response === 0;
      } else {
        confirmed = confirm(this.t('importConfirm'));
      }

      if (!confirmed) {
        return;
      }

      // 调用主进程导入
      const result = await this.prefsService.importPreferences();

      if (result.success) {
        // 应用导入的首选项
        await this.applyImportedPreferences(result.preferences);

        // 提示用户重启应用
        let shouldRestart = false;
        if (electronAPI?.dialog?.showMessageBox) {
          const restartResult = await electronAPI.dialog.showMessageBox({
            type: 'question',
            title: this.t('dialog.confirm'),
            message: this.t('restartAppNotify'),
            buttons: [this.t('dialog.ok'), this.t('dialog.cancel')],
            defaultId: 0,
            cancelId: 1,
            noLink: true
          });
          shouldRestart = restartResult.response === 0;
        } else {
          shouldRestart = confirm(this.t('restartAppNotify'));
        }

        if (shouldRestart) {
          await this.prefsService.relaunchApp();
        }
      } else {
        const statusElement = document.getElementById('status');
        if (statusElement) {
          statusElement.textContent = this.t('importFailed') + (result.error || '');
        }
      }
    } catch (error) {
      console.error('[PreferencesManager] Import failed:', error);
      const statusElement = document.getElementById('status');
      if (statusElement) {
        statusElement.textContent = this.t('importFailed') + (error.message || error);
      }
    }
  }

  /**
   * 应用导入的首选项
   */
  async applyImportedPreferences(prefs) {
    if (!prefs) return;

    // 应用语言设置
    if (prefs.language && this.i18n) {
      await this.i18n.setLanguage(prefs.language);
    }

    // 应用主题设置
    if (prefs.themeMode || prefs.theme) {
      const themeValue = prefs.themeMode || prefs.theme;
      await this.prefsService.set('themeMode', themeValue);
    }

    // 应用编辑器设置
    if (prefs.editorFontSize) {
      await this.appearance.applyEditorFontSize(prefs.editorFontSize);
    }
    if (prefs.editorFontFamily) {
      await this.appearance.applyEditorFontFamily(prefs.editorFontFamily);
    }

    // 应用预览设置
    if (prefs.previewFontSize) {
      await this.appearance.applyPreviewFontSize(prefs.previewFontSize);
    }
    if (prefs.previewFontFamily) {
      await this.appearance.applyPreviewFontFamily(prefs.previewFontFamily);
    }

    // 应用 AI 设置
    if (prefs.aiSettings) {
      await this.prefsService.set('aiSettings', prefs.aiSettings);
    }

    // 应用笔记保存路径
    if (prefs.noteSavePath) {
      await this.path.saveNoteSavePath(prefs.noteSavePath, false);
    }

    // 应用开机自启设置
    if (typeof prefs.startupOnLogin !== 'undefined') {
      await this.prefsService.setStartupEnabled(!!prefs.startupOnLogin);
    }

    // 应用自动更新设置
    if (typeof prefs.autoUpdate !== 'undefined') {
      await this.prefsService.set('autoUpdate', !!prefs.autoUpdate);
      await this.prefsService.toggleAutoUpdate(!!prefs.autoUpdate);
    }

    // 重新加载所有设置到 UI
    await this.loadAllSettingsToUI();
  }

  /**
   * 重置所有设置
   */
  async resetAllSettings() {
    // 显示确认对话框
    let confirmed = false;
    const electronAPI = window.electronAPI;
    
    if (electronAPI?.dialog?.showMessageBox) {
      const result = await electronAPI.dialog.showMessageBox({
        type: 'warning',
        title: this.t('dialog.confirm'),
        message: this.t('resetConfirmNotify'),
        buttons: [this.t('dialog.ok'), this.t('dialog.cancel')],
        defaultId: 0,
        cancelId: 1,
        noLink: true
      });
      confirmed = result.response === 0;
    } else {
      confirmed = confirm(this.t('resetConfirmNotify'));
    }

    if (!confirmed) {
      return;
    }

    // 重置各个管理器
    await this.general.reset();
    await this.appearance.reset();
    await this.path.reset();
    await this.ai.reset();
    await this.logging.reset();
  }

  /**
   * 设置键盘快捷键
   */
  setupKeyboardShortcuts() {
    // 字号快捷键：Ctrl+= / Ctrl+- / Ctrl+0
    window.addEventListener('keydown', async (e) => {
      if (!e.ctrlKey) return;

      const key = e.key;
      if (key === '=' || key === '+') {
        const cur = await this.prefsService.get('editorFontSize', DEFAULTS.EDITOR_FONT_SIZE);
        await this.appearance.applyEditorFontSize(cur + 1);
        e.preventDefault();
      } else if (key === '-') {
        const cur = await this.prefsService.get('editorFontSize', DEFAULTS.EDITOR_FONT_SIZE);
        await this.appearance.applyEditorFontSize(cur - 1);
        e.preventDefault();
      } else if (key === '0') {
        await this.appearance.applyEditorFontSize(DEFAULTS.EDITOR_FONT_SIZE);
        e.preventDefault();
      }
    });
  }

  /**
   * 翻译辅助函数
   */
  t(key) {
    return this.i18n?.t ? this.i18n.t(key) : key;
  }

  /**
   * 获取笔记保存路径
   */
  async getNoteSavePath() {
    return await this.path.getNoteSavePath();
  }

  /**
   * 销毁管理器
   */
  destroy() {
    this.modal.destroy();
    this.eventBus.clear();
  }
}
