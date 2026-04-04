import { app, globalShortcut } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { VFS_CONSTANTS } from '../constants/vfs.constants.js';
import { getAllCommands } from '../constants/commands.constants.js';
import { loggerService } from './logger.service.js';

const logger = loggerService.createLogger('Electron:Shortcuts Service');

export const shortcutsService = {
  getShortcutsPath() {
    return path.join(app.getPath(VFS_CONSTANTS.USER_DATA), 'keybindings.json');
  },

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

  async loadKeybindings() {
    const filePath = this.getShortcutsPath();
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      return parsed.keybindings || this.getDefaultKeybindings();
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.error('Failed to load keybindings', { error: error.message });
      }
      return this.getDefaultKeybindings();
    }
  },

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
      logger.error('Failed to save keybindings', { error: error.message });
      throw error;
    }
  },

  async addKeybinding(commandId, key, when = null) {
    const keybindings = await this.loadKeybindings();

    const existingIndex = keybindings.findIndex(kb =>
      kb.commandId === commandId && kb.key === key
    );

    if (existingIndex >= 0) {
      keybindings[existingIndex] = { commandId, key, when };
    } else {
      keybindings.push({ commandId, key, when });
    }

    return await this.saveKeybindings(keybindings);
  },

  async removeKeybinding(commandId, key) {
    const keybindings = await this.loadKeybindings();
    const filtered = keybindings.filter(kb =>
      !(kb.commandId === commandId && kb.key === key)
    );
    return await this.saveKeybindings(filtered);
  },

  async resetToDefaults() {
    const defaults = this.getDefaultKeybindings();
    return await this.saveKeybindings(defaults);
  },

  async detectConflicts(key, excludeCommandId = null) {
    const keybindings = await this.loadKeybindings();
    return keybindings.filter(kb =>
      kb.key === key && kb.commandId !== excludeCommandId
    );
  },

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

    const keyCode = parts[parts.length - 1];
    const modifiers = parts.slice(0, -1);

    for (const modifier of modifiers) {
      if (!validModifiers.includes(modifier)) {
        return false;
      }
    }

    if (keyCode.length === 0) {
      return false;
    }

    return true;
  },

  normalizeKeybinding(key) {
    if (!key) return '';

    return key
      .replace(/CmdOrCtrl/gi, 'CommandOrControl')
      .replace(/Cmd(?!\w)/gi, 'Command')
      .replace(/Ctrl(?!\w)/gi, 'Control')
      .split('+')
      .map(part => part.trim())
      .join('+');
  },

  registerGlobalShortcut(accelerator, callback) {
    try {
      const success = globalShortcut.register(accelerator, callback);
      if (!success) {
        logger.warn('Failed to register global shortcut', { accelerator });
      }
      return success;
    } catch (error) {
      logger.error('Error registering global shortcut', {
        accelerator,
        error: error.message,
      });
      return false;
    }
  },

  unregisterGlobalShortcut(accelerator) {
    try {
      globalShortcut.unregister(accelerator);
    } catch (error) {
      logger.error('Error unregistering global shortcut', {
        accelerator,
        error: error.message,
      });
    }
  },

  unregisterAllGlobalShortcuts() {
    globalShortcut.unregisterAll();
  },

  async getKeybindingsForCommand(commandId) {
    const keybindings = await this.loadKeybindings();
    return keybindings.filter(kb => kb.commandId === commandId);
  },

  async exportKeybindings() {
    const keybindings = await this.loadKeybindings();
    return {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      keybindings,
    };
  },

  async importKeybindings(config) {
    if (!config || !config.keybindings || !Array.isArray(config.keybindings)) {
      throw new Error('Invalid keybindings configuration');
    }
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
