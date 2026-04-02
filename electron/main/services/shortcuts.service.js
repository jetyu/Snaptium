import { app, globalShortcut } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { VFS_CONSTANTS } from '../constants/vfs.constants.js';
import { getAllCommands } from '../constants/commands.constants.js';

/**
 * 快捷键服务
 * 负责快捷键的存储、加载、验证和管理
 */
export const shortcutsService = {
  /**
   * 获取快捷键配置文件路径
   */
  getShortcutsPath() {
    return path.join(app.getPath(VFS_CONSTANTS.USER_DATA), 'keybindings.json');
  },

  /**
   * 获取默认快捷键配置
   */
  getDefaultKeybindings() {
    const commands = getAllCommands();
    return commands
      .filter(cmd => cmd.defaultKeybinding)
      .map(cmd => ({
        commandId: cmd.id,
        key: cmd.defaultKeybinding,
        when: cmd.when || null,
      }));
  },

  /**
   * 加载快捷键配置
   */
  async loadKeybindings() {
    const filePath = this.getShortcutsPath();
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      return parsed.keybindings || this.getDefaultKeybindings();
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Failed to load keybindings:', error);
      }
      return this.getDefaultKeybindings();
    }
  },

  /**
   * 保存快捷键配置
   */
  async saveKeybindings(keybindings) {
    const filePath = this.getShortcutsPath();
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      const config = {
        version: '1.0.0',
        keybindings,
      };
      await fs.writeFile(filePath, JSON.stringify(config, null, 2), 'utf-8');
      return keybindings;
    } catch (error) {
      console.error('Failed to save keybindings:', error);
      throw error;
    }
  },

  /**
   * 添加或更新快捷键绑定
   */
  async addKeybinding(commandId, key, when = null) {
    const keybindings = await this.loadKeybindings();
    
    // 检查是否已存在该命令的绑定
    const existingIndex = keybindings.findIndex(kb => 
      kb.commandId === commandId && kb.key === key
    );

    if (existingIndex >= 0) {
      // 更新现有绑定
      keybindings[existingIndex] = { commandId, key, when };
    } else {
      // 添加新绑定
      keybindings.push({ commandId, key, when });
    }

    return await this.saveKeybindings(keybindings);
  },

  /**
   * 删除快捷键绑定
   */
  async removeKeybinding(commandId, key) {
    const keybindings = await this.loadKeybindings();
    const filtered = keybindings.filter(kb => 
      !(kb.commandId === commandId && kb.key === key)
    );
    return await this.saveKeybindings(filtered);
  },

  /**
   * 重置为默认快捷键
   */
  async resetToDefaults() {
    const defaults = this.getDefaultKeybindings();
    return await this.saveKeybindings(defaults);
  },

  /**
   * 检测快捷键冲突
   * @param {string} key - 快捷键组合
   * @param {string} excludeCommandId - 排除的命令 ID（用于编辑时）
   * @returns {Array} 冲突的命令列表
   */
  async detectConflicts(key, excludeCommandId = null) {
    const keybindings = await this.loadKeybindings();
    return keybindings.filter(kb => 
      kb.key === key && kb.commandId !== excludeCommandId
    );
  },

  /**
   * 验证快捷键格式
   * @param {string} key - 快捷键组合
   * @returns {boolean} 是否有效
   */
  validateKeybinding(key) {
    if (!key || typeof key !== 'string') {
      return false;
    }

    // 基本格式验证
    const validModifiers = [
      'CommandOrControl', 'CmdOrCtrl', 'Command', 'Cmd',
      'Control', 'Ctrl', 'Alt', 'Option', 'Shift', 'Meta', 'Super'
    ];
    
    const parts = key.split('+');
    if (parts.length === 0) {
      return false;
    }

    // 最后一个必须是按键，前面的必须是修饰键
    const keyCode = parts[parts.length - 1];
    const modifiers = parts.slice(0, -1);

    // 验证修饰键
    for (const modifier of modifiers) {
      if (!validModifiers.includes(modifier)) {
        return false;
      }
    }

    // 验证按键代码（简化版）
    if (keyCode.length === 0) {
      return false;
    }

    return true;
  },

  /**
   * 规范化快捷键格式
   * @param {string} key - 快捷键组合
   * @returns {string} 规范化后的快捷键
   */
  normalizeKeybinding(key) {
    if (!key) return '';
    
    // 统一修饰键名称
    return key
      .replace(/CmdOrCtrl/gi, 'CommandOrControl')
      .replace(/Cmd(?!\w)/gi, 'Command')
      .replace(/Ctrl(?!\w)/gi, 'Control')
      .split('+')
      .map(part => part.trim())
      .join('+');
  },

  /**
   * 注册全局快捷键
   * @param {string} accelerator - 快捷键组合
   * @param {Function} callback - 回调函数
   */
  registerGlobalShortcut(accelerator, callback) {
    try {
      const success = globalShortcut.register(accelerator, callback);
      if (!success) {
        console.warn(`Failed to register global shortcut: ${accelerator}`);
      }
      return success;
    } catch (error) {
      console.error(`Error registering global shortcut ${accelerator}:`, error);
      return false;
    }
  },

  /**
   * 注销全局快捷键
   * @param {string} accelerator - 快捷键组合
   */
  unregisterGlobalShortcut(accelerator) {
    try {
      globalShortcut.unregister(accelerator);
    } catch (error) {
      console.error(`Error unregistering global shortcut ${accelerator}:`, error);
    }
  },

  /**
   * 注销所有全局快捷键
   */
  unregisterAllGlobalShortcuts() {
    globalShortcut.unregisterAll();
  },

  /**
   * 获取命令的快捷键
   * @param {string} commandId - 命令 ID
   * @returns {Array} 快捷键列表
   */
  async getKeybindingsForCommand(commandId) {
    const keybindings = await this.loadKeybindings();
    return keybindings.filter(kb => kb.commandId === commandId);
  },

  /**
   * 导出快捷键配置
   */
  async exportKeybindings() {
    const keybindings = await this.loadKeybindings();
    return {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      keybindings,
    };
  },

  /**
   * 导入快捷键配置
   * @param {Object} config - 配置对象
   */
  async importKeybindings(config) {
    if (!config || !config.keybindings || !Array.isArray(config.keybindings)) {
      throw new Error('Invalid keybindings configuration');
    }

    // 验证每个快捷键
    for (const kb of config.keybindings) {
      if (!kb.commandId || !kb.key) {
        throw new Error('Invalid keybinding entry');
      }
      if (!this.validateKeybinding(kb.key)) {
        throw new Error(`Invalid keybinding format: ${kb.key}`);
      }
    }

    return await this.saveKeybindings(config.keybindings);
  },
};
