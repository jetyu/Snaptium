/**
 * 国际化管理模块
 * 负责语言加载、翻译和语言切换
 */

const DEFAULT_LANG = "en-US";

/**
 * 创建国际化管理器
 * @param {Object} deps - 依赖注入
 * @param {Object} deps.fs - 文件系统模块
 * @param {Object} deps.path - 路径模块
 * @param {Object} deps.ipcMain - IPC 主进程模块
 * @param {string} deps.localesDir - 语言文件目录路径
 * @param {Function} deps.getPreference - 获取配置函数
 * @param {Function} deps.setPreference - 设置配置函数
 * @param {Function} deps.onLanguageChanged - 语言切换回调函数
 * @returns {Object} 国际化管理器实例
 */
export function createI18nManager(deps) {
  const { fs, path, ipcMain, localesDir, getPreference, setPreference, onLanguageChanged } = deps;
  
  let currentLang = DEFAULT_LANG;
  let translations = {};

  /**
   * 加载指定语言文件
   * @param {string} lang - 语言代码
   * @returns {boolean} 是否加载成功
   */
  function loadLanguage(lang) {
    try {
      const langFile = path.join(localesDir, `${lang}.json`);
      if (fs.existsSync(langFile)) {
        const data = fs.readFileSync(langFile, "utf8");
        translations = JSON.parse(data);
        currentLang = lang;
        return true;
      }
    } catch (error) {
      console.error(`Failed to load language ${lang}:`, error);
    }
    return false;
  }

  /**
   * 获取翻译文本
   * @param {string} key - 翻译键
   * @returns {string} 翻译后的文本，如果找不到则返回键本身
   */
  function t(key) {
    return translations[key] || key;
  }

  /**
   * 从配置中获取用户首选语言
   * @returns {string} 语言代码
   */
  function getUserLanguage() {
    return getPreference('language', DEFAULT_LANG);
  }

  /**
   * 初始化语言设置
   * 尝试加载用户首选语言，失败则使用默认语言
   */
  function initLanguage() {
    const userLang = getUserLanguage();
    if (!loadLanguage(userLang)) {
      loadLanguage(DEFAULT_LANG);
    }
  }

  /**
   * 获取当前语言代码
   * @returns {string} 当前语言代码
   */
  function getCurrentLang() {
    return currentLang;
  }

  /**
   * 切换语言并保存到配置
   * @param {string} lang - 新的语言代码
   * @returns {boolean} 是否切换成功
   */
  function switchLanguage(lang) {
    if (loadLanguage(lang)) {
      setPreference('language', lang);
      
      // 触发语言切换回调（重建菜单、托盘等）
      if (onLanguageChanged) {
        onLanguageChanged(lang);
      }
      
      return true;
    }
    return false;
  }

  /**
   * 注册 IPC 处理器
   */
  function registerIpcHandlers() {
    // 监听语言切换
    ipcMain.on("language-changed", (event, lang) => {
      switchLanguage(lang);
    });
  }

  // 自动注册 IPC 处理器
  if (ipcMain) {
    registerIpcHandlers();
  }

  return {
    loadLanguage,
    t,
    initLanguage,
    getCurrentLang,
    switchLanguage,
    getUserLanguage
  };
}
