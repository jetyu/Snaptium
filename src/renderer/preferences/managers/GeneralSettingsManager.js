/**
 * 通用设置管理器
 * 负责语言、主题和开机自启设置
 */
import { SELECTORS, DEFAULTS, STORAGE_KEYS } from '../constants.js';
import { applyThemeByMode } from '../../theme.js';

export class GeneralSettingsManager {
  constructor(deps) {
    this.prefsService = deps.prefsService;
    this.i18n = deps.i18n;
    this.eventBus = deps.eventBus;
    this.modal = deps.modal;

    this.systemListenerSetup = false;
    this.isInitialized = false;
    this.eventsbound = false;
  }

  /**
   * 初始化
   */
  async init() {
    if (this.isInitialized) return;

    await this.loadSettings();
    this.bindEvents();

    this.isInitialized = true;
  }

  /**
   * 加载设置
   */
  async loadSettings() {
    // 加载并应用主题
    const themeMode = await this.prefsService.get('themeMode', DEFAULTS.THEME_MODE);
    applyThemeByMode(themeMode);

    // 设置系统主题监听
    await this.setupSystemWatcher();
  }

  /**
   * 加载到 UI
   */
  async loadToUI() {
    const modalElement = this.modal.getModal();
    if (!modalElement) return;

    // 加载主题设置
    await this.loadThemeToUI(modalElement);

    // 加载语言设置
    await this.loadLanguageToUI(modalElement);

    // 加载开机自启设置
    await this.loadStartupToUI(modalElement);

    // 加载自动更新设置
    await this.loadAutoUpdateToUI(modalElement);
  }

  /**
   * 加载主题设置到 UI
   */
  async loadThemeToUI(modalElement) {
    const themeSelect = modalElement.querySelector(SELECTORS.THEME_SELECT);
    if (!themeSelect) return;

    const themeMode = await this.prefsService.get('themeMode', DEFAULTS.THEME_MODE);
    themeSelect.value = themeMode;
  }

  /**
   * 加载语言设置到 UI
   */
  async loadLanguageToUI(modalElement) {
    const langSelect = modalElement.querySelector(SELECTORS.LANG_SELECT);
    if (!langSelect || !this.i18n) return;

    try {
      // 确保 i18n 已初始化
      await this.i18n.ensureInitialized();

      // 获取支持的语言列表
      const supportedLangs = this.i18n.getSupportedLanguagesWithNames();

      // 清空现有选项
      langSelect.innerHTML = '';

      // 添加语言选项
      supportedLangs.forEach(({ code, name }) => {
        const option = document.createElement('option');
        option.value = code;
        option.textContent = name;
        langSelect.appendChild(option);
      });

      // 设置当前选中的语言
      langSelect.value = this.i18n.currentLanguage;
    } catch (error) {
      console.error('[GeneralSettingsManager] Failed to load language settings:', error);
    }
  }

  /**
   * 加载开机自启设置到 UI
   */
  async loadStartupToUI(modalElement) {
    const startupCheckbox = modalElement.querySelector(SELECTORS.STARTUP_CHECKBOX);
    if (!startupCheckbox) return;

    try {
      // 优先从主进程查询系统设置
      const result = await this.prefsService.getStartupEnabled();
      if (result && result.success) {
        startupCheckbox.checked = !!result.enabled;
        try {
          localStorage.setItem(STORAGE_KEYS.STARTUP_ON_LOGIN, String(!!result.enabled));
        } catch { }
      } else {
        // 从本地存储读取
        const saved = localStorage.getItem(STORAGE_KEYS.STARTUP_ON_LOGIN);
        startupCheckbox.checked = saved === 'true';
      }
    } catch (error) {
      console.error('[GeneralSettingsManager] Failed to load startup settings:', error);
      const saved = localStorage.getItem(STORAGE_KEYS.STARTUP_ON_LOGIN);
      startupCheckbox.checked = saved === 'true';
    }
  }

  /**
   * 加载自动更新设置到 UI
   */
  async loadAutoUpdateToUI(modalElement) {
    const autoUpdateCheckbox = modalElement.querySelector('#pref-auto-update');
    if (!autoUpdateCheckbox) return;

    try {
      const autoUpdate = await this.prefsService.get('autoUpdate', true); // Default to true
      autoUpdateCheckbox.checked = !!autoUpdate;
    } catch (error) {
      console.error('[GeneralSettingsManager] Failed to load auto-update settings:', error);
      autoUpdateCheckbox.checked = true; // Default to enabled
    }
  }

  /**
   * 绑定事件
   */
  bindEvents() {
    // 防止重复绑定
    if (this.eventsBound) return;

    const modalElement = this.modal.getModal();
    if (!modalElement) return;

    // 主题切换
    this.bindThemeEvents(modalElement);

    // 语言切换
    this.bindLanguageEvents(modalElement);

    // 开机自启
    this.bindStartupEvents(modalElement);

    // 自动更新
    this.bindAutoUpdateEvents(modalElement);

    this.eventsBound = true;
  }

  /**
   * 绑定主题事件
   */
  bindThemeEvents(modalElement) {
    const themeSelect = modalElement.querySelector(SELECTORS.THEME_SELECT);
    if (!themeSelect) return;

    themeSelect.addEventListener('change', async () => {
      const mode = themeSelect.value;
      await this.prefsService.set('themeMode', mode);
      applyThemeByMode(mode);

      if (mode === 'system') {
        await this.setupSystemWatcher();
      }
    });
  }

  /**
   * 绑定语言事件
   */
  bindLanguageEvents(modalElement) {
    const langSelect = modalElement.querySelector(SELECTORS.LANG_SELECT);
    if (!langSelect) {
      console.warn('[GeneralSettingsManager] Language select element not found');
      return;
    }
    if (!this.i18n) {
      console.warn('[GeneralSettingsManager] i18n not available');
      return;
    }

    langSelect.addEventListener('change', async () => {
      try {
        const selectedLang = langSelect.value;
        await this.i18n.setLanguage(selectedLang);

        // 更新下拉框显示
        const selectedOption = langSelect.querySelector(`option[value="${selectedLang}"]`);
        if (selectedOption) {
          selectedOption.textContent = this.i18n.getLanguageDisplayName(selectedLang);
        }
      } catch (error) {
        console.error('[GeneralSettingsManager] Failed to change language:', error);
      }
    });
  }

  /**
   * 绑定开机自启事件
   */
  bindStartupEvents(modalElement) {
    const startupCheckbox = modalElement.querySelector(SELECTORS.STARTUP_CHECKBOX);
    if (!startupCheckbox) return;

    startupCheckbox.addEventListener('change', async () => {
      const desired = !!startupCheckbox.checked;
      startupCheckbox.disabled = true;

      try {
        const result = await this.prefsService.setStartupEnabled(desired);

        if (result && result.success) {
          try {
            localStorage.setItem(STORAGE_KEYS.STARTUP_ON_LOGIN, String(desired));
          } catch { }

          this.showStatus(desired ? '已启用开机自启' : '已禁用开机自启');
        } else {
          // 恢复原状态
          startupCheckbox.checked = !desired;
          this.showStatus('设置开机自启失败' + (result?.error ? ': ' + result.error : ''));
        }
      } catch (error) {
        startupCheckbox.checked = !desired;
        this.showStatus('设置开机自启失败: ' + (error.message || error));
      } finally {
        startupCheckbox.disabled = false;
      }
    });
  }

  /**
   * 绑定自动更新事件
   */
  bindAutoUpdateEvents(modalElement) {
    const autoUpdateCheckbox = modalElement.querySelector('#pref-auto-update');
    if (!autoUpdateCheckbox) return;

    autoUpdateCheckbox.addEventListener('change', async () => {
      const enabled = !!autoUpdateCheckbox.checked;
      autoUpdateCheckbox.disabled = true;

      try {
        await this.prefsService.set('autoUpdate', enabled);

        // Notify main process to start/stop auto-update check
        await this.prefsService.toggleAutoUpdate(enabled);

        this.showStatus(enabled ? '已启用自动更新检查' : '已禁用自动更新检查');
      } catch (error) {
        autoUpdateCheckbox.checked = !enabled;
        this.showStatus('设置自动更新失败: ' + (error.message || error));
      } finally {
        autoUpdateCheckbox.disabled = false;
      }
    });
  }

  /**
   * 设置系统主题监听
   */
  async setupSystemWatcher() {
    if (this.systemListenerSetup) return;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = async () => {
      const mode = await this.prefsService.get('themeMode', DEFAULTS.THEME_MODE);
      if (mode === 'system') {
        applyThemeByMode(mode);
      }
    };

    if (mq.addEventListener) {
      mq.addEventListener('change', handler);
    } else if (mq.addListener) {
      mq.addListener(handler);
    }

    this.systemListenerSetup = true;
  }

  /**
   * 显示状态消息
   */
  showStatus(message) {
    const statusElement = document.getElementById('status');
    if (statusElement) {
      statusElement.textContent = message;
    }
  }

  /**
   * 重置到默认值
   */
  async reset() {
    // 重置语言
    if (this.i18n) {
      try {
        await this.i18n.setLanguage(DEFAULTS.LANGUAGE);
        this.i18n.applyI18n();
      } catch (error) {
        console.error('[GeneralSettingsManager] Failed to reset language:', error);
      }
    }

    // 重置主题
    await this.prefsService.set('themeMode', DEFAULTS.THEME_MODE);
    applyThemeByMode(DEFAULTS.THEME_MODE);

    // 更新 UI
    await this.loadToUI();

    // 重置自动更新到默认值（启用）
    await this.prefsService.set('autoUpdate', true);
  }
}
