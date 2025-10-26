const electronAPI = window.electronAPI;

if (!electronAPI) {
  throw new Error('electronAPI 未初始化，无法在渲染进程访问受信任的 Node API');
}

const {
  ipcRenderer,
  path: electronPath,
  fs: electronFs,
} = electronAPI;

const DEFAULT_LANG = "en-US";

// 防止重复初始化的标志
let isI18nInitialized = false;

function resolveFilePath(relativePath) {
  let pathname = decodeURIComponent(new URL(relativePath, import.meta.url).pathname);
  if (/^\/[A-Za-z]:/.test(pathname)) {
    pathname = pathname.slice(1);
  }
  return pathname;
}

const LOCALES_PATH = resolveFilePath('../locales');

// 存储所有加载的语言包
const dict = {};
let currentLang = DEFAULT_LANG;

// 加载语言包
async function loadLanguage(lang) {
  try {
    const filePath = electronPath.join(LOCALES_PATH, `${lang}.json`);
    const data = await electronFs.readFile(filePath, 'utf8');
    dict[lang] = JSON.parse(data);
    return dict[lang];
  } catch (error) {
    if (lang === DEFAULT_LANG) {
      console.warn(`Failed to load default language pack: ${error.message}`);
      dict[DEFAULT_LANG] = {};
      return dict[DEFAULT_LANG];
    }
    return loadLanguage(DEFAULT_LANG);
  }
}

// 初始化语言包
async function initLanguage() {
  try {
    // 从 preferences.json 读取语言设置
    const savedLang = await ipcRenderer.invoke('preferences:get', 'language', null);
    currentLang = savedLang || DEFAULT_LANG;
    
    // 确保语言在支持的语言列表中
    const supportedLangs = getSupportedLanguages();
    if (!supportedLangs.includes(currentLang)) {
      // 尝试匹配基础语言代码
      const baseLang = currentLang.split('-')[0];
      const matchedLang = supportedLangs.find(lang => lang.startsWith(baseLang));
      currentLang = matchedLang || DEFAULT_LANG;
    }
    
    // 加载语言包
    await loadLanguage(currentLang);
    
    // 更新HTML lang属性
    document.documentElement.lang = currentLang;
    
    return currentLang;
  } catch (error) {
    currentLang = DEFAULT_LANG;
    await loadLanguage(DEFAULT_LANG);
    return currentLang;
  }
}

async function getLanguage() {
  return currentLang;
}

async function setLanguage(lang) {
  if (lang === currentLang) return currentLang;
  
  try {
    if (!dict[lang]) {
      await loadLanguage(lang);
    }
    
    // 更新当前语言
    currentLang = lang;
    
    // 保存到 preferences.json
    await ipcRenderer.invoke('preferences:set', 'language', lang);
    
    // 应用新的语言
    await applyI18n();
    
    // 通知主进程语言已更改
    ipcRenderer.send('language-changed', lang);
    
    return lang;
  } catch (error) {
    // 设置失败，回退到默认语言
    if (lang !== DEFAULT_LANG) {
      return setLanguage(DEFAULT_LANG);
    }
    throw error;
  }
}

function t(key) {
  // 如果当前语言包中找不到，尝试从默认语言包中获取
  return dict[currentLang]?.[key] || dict[DEFAULT_LANG]?.[key] || key;
}

async function applyI18n() {
  if (!dict[currentLang]) {
    await loadLanguage(currentLang);
  }

  // 更新所有带有data-i18n属性的元素
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) {
      el.textContent = t(key);
    }
  });

  // 更新所有带有data-i18n-placeholder属性的元素
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) {
      el.placeholder = t(key);
    }
  });

  // 更新所有带有data-i18n-title属性的元素
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (key) {
      el.title = t(key);
    }
  });

  // 更新HTML lang属性
  document.documentElement.lang = currentLang;
  
  // 触发自定义事件，通知其他模块语言已更改
  const event = new CustomEvent('languageChanged', { detail: { lang: currentLang } });
  window.dispatchEvent(event);
}

async function initI18n() {
  // 防止重复初始化
  if (isI18nInitialized) {
    return currentLang;
  }
  
  try {
    // 初始化语言
    await initLanguage();
    
    // 应用当前语言
    await applyI18n();
    
    // 标记为已初始化
    isI18nInitialized = true;
    
    return currentLang;
  } catch (error) {
    console.error('Failed to initialize i18n', error);
    return DEFAULT_LANG;
  }
}

async function ensureI18nInitialized() {
    try {
      const savedLang = await ipcRenderer.invoke('preferences:get', 'language', null);
      if (savedLang) {
        await setLanguage(savedLang);
      } else {
        await initI18n();
      }
    } catch (error) {
      await setLanguage(DEFAULT_LANG);
    }
    return currentLang;
  }



// 注意: 初始化由 renderer_bootstrap.js 统一管理
// 不再在此处自动初始化,避免重复初始化和时序问题

// 加载语言提供者配置
let localesProviders = {};
try {
  const localesProvidersPath = resolveFilePath('../config/locales-providers.json');
  if (electronFs.existsSync(localesProvidersPath)) {
    localesProviders = JSON.parse(electronFs.readFileSync(localesProvidersPath, 'utf8'));
  }
} catch (error) {
  // 静默失败
}

// 获取语言显示名称
function getLanguageDisplayName(lang) {
  return localesProviders[lang] || lang;
}

// 获取支持的语言列表
function getSupportedLanguagesWithNames() {
  try {
    const supportedLangs = electronFs.readdirSync(LOCALES_PATH)
      .filter(file => file.endsWith('.json'))
      .map((file) => electronPath.basename(file, '.json'));
    
    return supportedLangs.map(code => ({
      code,
      name: getLanguageDisplayName(code) || code
    }));
  } catch (error) {
    return [{ code: DEFAULT_LANG, name: getLanguageDisplayName(DEFAULT_LANG) }];
  }
}

// 导出API
export function getSupportedLanguages() {
  try {
    return electronFs
      .readdirSync(LOCALES_PATH)
      .filter((file) => file.endsWith('.json'))
      .map((file) => electronPath.basename(file, '.json'));
  } catch (error) {
    return [DEFAULT_LANG];
  }
}

export {
  getLanguage,
  setLanguage,
  t,
  applyI18n,
  initI18n,
  DEFAULT_LANG,
  ensureI18nInitialized as ensureInitialized,
  getLanguageDisplayName as getCurrentLanguageName,
  getSupportedLanguagesWithNames,
  getLanguageDisplayName,
};

const i18nAPI = {
  getLanguage,
  setLanguage,
  t,
  applyI18n,
  initI18n,
  DEFAULT_LANG,
  ensureInitialized: ensureI18nInitialized,
  get currentLanguage() {
    return currentLang;
  },
  getCurrentLanguageName: () => getLanguageDisplayName(currentLang),
  getSupportedLanguages,
  getSupportedLanguagesWithNames,
  getLanguageDisplayName,
};

export default i18nAPI;
