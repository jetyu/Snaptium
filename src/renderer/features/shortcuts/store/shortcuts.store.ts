import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { shortcutsService } from '../services/shortcuts.service';
import { keyboardService } from '../services/keyboard.service';
import { createLogger } from '@renderer/features/logger';

const shortcutsLogger = createLogger('ShortcutsStore');

/**
 * 命令分类
 */
export enum CommandCategory {
  FILE = 'file',
  EDIT = 'edit',
  VIEW = 'view',
  SEARCH = 'search',
  APP = 'app',
}

/**
 * 命令定义
 */
export interface Command {
  id: string;
  category: CommandCategory;
  defaultKeybinding?: string | null;
}

/**
 * 快捷键绑定
 */
export interface Keybinding {
  commandId: string;
  key: string;
  when?: string | null;
}

/**
 * 快捷键配置
 */
export interface KeybindingsConfig {
  version: string;
  keybindings: Keybinding[];
}

/**
 * 快捷键冲突信息
 */
export interface KeybindingConflict {
  commandId: string;
  key: string;
  when?: string | null;
}

/**
 * 命令执行上下文
 */
export interface CommandContext {
  editorFocus?: boolean;
  workspaceFocus?: boolean;
  previewFocus?: boolean;
}

/**
 * 快捷键事件
 */
export interface KeyboardEventInfo {
  key: string;
  code: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}

export const useShortcutsStore = defineStore('shortcuts', () => {
  // 状态
  const commands = ref<Command[]>([]);
  const keybindings = ref<Keybinding[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // 计算属性
  const commandsMap = computed(() => {
    const map = new Map<string, Command>();
    commands.value.forEach(cmd => map.set(cmd.id, cmd));
    return map;
  });

  const keybindingsMap = computed(() => {
    const map = new Map<string, Keybinding[]>();
    keybindings.value.forEach(kb => {
      const existing = map.get(kb.commandId) || [];
      existing.push(kb);
      map.set(kb.commandId, existing);
    });
    return map;
  });

  // 根据分类分组命令
  const commandsByCategory = computed(() => {
    const grouped = new Map<CommandCategory, Command[]>();
    commands.value.forEach(cmd => {
      const existing = grouped.get(cmd.category) || [];
      existing.push(cmd);
      grouped.set(cmd.category, existing);
    });
    return grouped;
  });

  // 操作
  async function loadCommands() {
    try {
      loading.value = true;
      error.value = null;
      commands.value = await shortcutsService.getCommands();
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load commands';
      shortcutsLogger.error(`Failed to load commands: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      loading.value = false;
    }
  }

  async function loadKeybindings() {
    try {
      loading.value = true;
      error.value = null;
      keybindings.value = await shortcutsService.loadKeybindings();
      
      // 更新键盘管理器
      keyboardService.setKeybindings(keybindings.value);
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load keybindings';
      shortcutsLogger.error(`Failed to load keybindings: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      loading.value = false;
    }
  }

  async function saveKeybindings() {
    try {
      loading.value = true;
      error.value = null;
      keybindings.value = await shortcutsService.saveKeybindings(keybindings.value);
      
      // 更新键盘管理器
      keyboardService.setKeybindings(keybindings.value);
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to save keybindings';
      shortcutsLogger.error(`Failed to save keybindings: ${e instanceof Error ? e.message : String(e)}`);
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function addKeybinding(commandId: string, key: string, when?: string | null) {
    try {
      loading.value = true;
      error.value = null;
      keybindings.value = await shortcutsService.addKeybinding(commandId, key, when);
      
      // 更新键盘管理器
      keyboardService.setKeybindings(keybindings.value);
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to add keybinding';
      shortcutsLogger.error(`Failed to add keybinding: ${e instanceof Error ? e.message : String(e)}`);
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function removeKeybinding(commandId: string, key: string) {
    try {
      loading.value = true;
      error.value = null;
      keybindings.value = await shortcutsService.removeKeybinding(commandId, key);
      
      // 更新键盘管理器
      keyboardService.setKeybindings(keybindings.value);
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to remove keybinding';
      shortcutsLogger.error(`Failed to remove keybinding: ${e instanceof Error ? e.message : String(e)}`);
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function resetToDefaults() {
    try {
      loading.value = true;
      error.value = null;
      keybindings.value = await shortcutsService.resetToDefaults();
      
      // 更新键盘管理器
      keyboardService.setKeybindings(keybindings.value);
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to reset keybindings';
      shortcutsLogger.error(`Failed to reset keybindings: ${e instanceof Error ? e.message : String(e)}`);
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function detectConflicts(key: string, excludeCommandId?: string) {
    try {
      return await shortcutsService.detectConflicts(key, excludeCommandId);
    } catch (e) {
      shortcutsLogger.error(`Failed to detect conflicts: ${e instanceof Error ? e.message : String(e)}`);
      return [];
    }
  }

  function getKeybindingsForCommand(commandId: string): Keybinding[] {
    return keybindingsMap.value.get(commandId) || [];
  }

  function getCommand(commandId: string): Command | undefined {
    return commandsMap.value.get(commandId);
  }

  // 初始化
  async function initialize() {
    await Promise.all([loadCommands(), loadKeybindings()]);
    
    // 启动键盘管理器
    keyboardService.startListening();
  }

  return {
    // 状态
    commands,
    keybindings,
    loading,
    error,
    
    // 计算属性
    commandsMap,
    keybindingsMap,
    commandsByCategory,
    
    // 操作
    loadCommands,
    loadKeybindings,
    saveKeybindings,
    addKeybinding,
    removeKeybinding,
    resetToDefaults,
    detectConflicts,
    getKeybindingsForCommand,
    getCommand,
    initialize,
  };
});
