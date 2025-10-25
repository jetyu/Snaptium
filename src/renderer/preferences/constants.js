/**
 * Preferences 模块常量定义
 */

// DOM 选择器
export const SELECTORS = {
  // 模态框
  MODAL: '#preferences-modal',
  MODAL_CLOSE: '#pref-close',
  
  // 侧边栏
  SIDEBAR: '.pref-sidebar',
  SIDEBAR_ITEMS: '.pref-sidebar li',
  
  // 面板
  PANES: '.pref-pane',
  
  // 通用设置
  STARTUP_CHECKBOX: '#pref-startup',
  LANG_SELECT: '#pref-lang',
  THEME_SELECT: '#pref-theme-mode',
  
  // 路径设置
  NOTE_SAVE_PATH_INPUT: '#pref-note-save-path',
  BROWSE_PATH_BTN: '#browse-note-save-path',
  
  // 外观设置
  EDITOR_FONT_INPUT: '#pref-editor-font',
  EDITOR_FONT_FAMILY_SELECT: '#pref-editor-font-family',
  PREVIEW_FONT_INPUT: '#pref-preview-font',
  PREVIEW_FONT_FAMILY_SELECT: '#pref-preview-font-family',
  
  // AI 设置
  AI_ENABLED_INPUT: '#pref-ai-enabled',
  AI_TYPING_DELAY_INPUT: '#pref-ai-typing-delay',
  AI_TYPING_LENGTH_INPUT: '#pref-ai-typing-length',
  AI_MODEL_INPUT: '#pref-ai-model',
  AI_API_KEY_INPUT: '#pref-ai-api-key',
  AI_ENDPOINT_INPUT: '#pref-ai-endpoint',
  AI_SYSTEM_PROMPT_INPUT: '#pref-ai-system-prompt',
  AI_TEST_BTN: '#pref-ai-test',
  AI_TEST_STATUS: '#pref-ai-test-status',
  
  // 操作按钮
  RESET_BTN: '#pref-reset',
  EXPORT_BTN: '#pref-export',
  IMPORT_BTN: '#pref-import',
  
  // 状态显示
  STATUS: '#status',
};

// 默认值
export const DEFAULTS = {
  THEME_MODE: 'system',
  LANGUAGE: 'en-US',
  EDITOR_FONT_SIZE: 14,
  PREVIEW_FONT_SIZE: 14,
  EDITOR_FONT_FAMILY: "'Microsoft YaHei', '微软雅黑', sans-serif",
  PREVIEW_FONT_FAMILY: "'Microsoft YaHei', '微软雅黑', sans-serif",
  
  AI_SETTINGS: {
    enabled: false,
    typingDelay: 2000,
    minInputLength: 10,
    model: '',
    apiKey: '',
    endpoint: '',
    systemPrompt: ''
  },
  
  STARTUP_ON_LOGIN: false,
};

// 字体大小限制
export const FONT_SIZE = {
  MIN: 10,
  MAX: 24,
};

// CSS 变量名
export const CSS_VARS = {
  EDITOR_FONT_SIZE: '--editor-font-size',
  PREVIEW_FONT_SIZE: '--preview-font-size',
  EDITOR_FONT_FAMILY: '--editor-font-family',
  PREVIEW_FONT_FAMILY: '--preview-font-family',
};

// 事件名称
export const EVENTS = {
  NOTE_SAVE_PATH_CHANGED: 'noteSavePathChanged',
  AI_SETTINGS_CHANGED: 'ai-settings-changed',
  OPEN_PREFERENCES: 'open-preferences',
};

// 本地存储键
export const STORAGE_KEYS = {
  PREF_ACTIVE_PANE: 'prefActivePane',
  PREVIOUS_NOTE_SAVE_PATH: 'previousNoteSavePath',
  STARTUP_ON_LOGIN: 'startupOnLogin',
  PREVIEW_PANEL_WIDTH: 'previewPanelWidth',
};

// 面板标识
export const PANES = {
  GENERAL: 'general',
  APPEARANCE: 'appearance',
  AI: 'ai',
};

// IPC 通道
export const IPC_CHANNELS = {
  PREFERENCES_GET: 'preferences:get',
  PREFERENCES_SET: 'preferences:set',
  PREFERENCES_GET_ALL: 'preferences:getAll',
  PREFERENCES_SAVE_ALL: 'preferences:saveAll',
  EXPORT_PREFERENCES: 'export-preferences',
  IMPORT_PREFERENCES: 'import-preferences',
  GET_DEFAULT_SAVE_PATH: 'get-default-save-path',
  SELECT_DIRECTORY: 'select-directory',
  ENSURE_DIRECTORY_EXISTS: 'ensure-directory-exists',
  RELAUNCH_APP: 'relaunch-app',
  GET_STARTUP_ENABLED: 'get-startup-enabled',
  SET_STARTUP_ENABLED: 'set-startup-enabled',
};

// 模板路径（相对于 ui/ModalController.js 的位置）
export const TEMPLATE_PATH = '../preferences.html';
