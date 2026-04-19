/**
 * 命令分类
 */
export const COMMAND_CATEGORIES = {
  FILE: 'file',
  SEARCH: 'search',
  APP: 'app',
};

/**
 * 预定义命令列表
 * 每个命令包含：id, label, description, category, defaultKeybinding
 */
export const COMMANDS = {
  // 文件操作
  FILE_NEW: {
    id: 'file.new',
    category: COMMAND_CATEGORIES.FILE,
    defaultKeybinding: 'CommandOrControl+N',
  },
  FILE_SAVE: {
    id: 'file.save',
    category: COMMAND_CATEGORIES.FILE,
    defaultKeybinding: 'CommandOrControl+S',
  },
  FILE_DELETE: {
    id: 'file.delete',
    category: COMMAND_CATEGORIES.FILE,
    defaultKeybinding: null,
  },
  FILE_RENAME: {
    id: 'file.rename',
    category: COMMAND_CATEGORIES.FILE,
    defaultKeybinding: 'F2',
  },

  // 搜索操作
  SEARCH_FIND: {
    id: 'search.find',
    category: COMMAND_CATEGORIES.SEARCH,
    defaultKeybinding: 'CommandOrControl+F',
  },
  SEARCH_FIND_IN_FILES: {
    id: 'search.findInFiles',
    category: COMMAND_CATEGORIES.SEARCH,
    defaultKeybinding: 'CommandOrControl+Shift+F',
  },

  // 应用操作
  APP_PREFERENCES: {
    id: 'app.preferences',
    category: COMMAND_CATEGORIES.APP,
    defaultKeybinding: 'CommandOrControl+,',
  },
  APP_QUIT: {
    id: 'app.quit',
    category: COMMAND_CATEGORIES.APP,
    defaultKeybinding: 'CommandOrControl+Q',
  },
};

/**
 * 获取所有命令列表
 */
export function getAllCommands() {
  return Object.values(COMMANDS);
}

/**
 * 根据 ID 获取命令
 */
export function getCommandById(id) {
  return Object.values(COMMANDS).find(cmd => cmd.id === id);
}

/**
 * 根据分类获取命令
 */
export function getCommandsByCategory(category) {
  return Object.values(COMMANDS).filter(cmd => cmd.category === category);
}
