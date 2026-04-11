import type { Command, Keybinding, KeybindingsConfig, KeybindingConflict } from '../store/shortcuts.store';
import { electronApi } from '@renderer/core/bridge/electronApi';

/**
 * 快捷键服务 - 渲染进程
 * 通过 IPC 与主进程通信
 */
export const shortcutsService = {
  /**
   * 获取所有命令
   */
  async getCommands(): Promise<Command[]> {
    const result = await electronApi.shortcuts.getCommands();
    if (!result || !result.success) {
      throw new Error(result?.error || 'Failed to get commands');
    }
    return result.data as Command[];
  },

  /**
   * 根据分类获取命令
   */
  async getCommandsByCategory(category: string): Promise<Command[]> {
    const result = await electronApi.shortcuts.getCommandsByCategory(category);
    if (!result || !result.success) {
      throw new Error(result?.error || 'Failed to get commands by category');
    }
    return result.data as Command[];
  },

  /**
   * 加载快捷键配置
   */
  async loadKeybindings(): Promise<Keybinding[]> {
    const result = await electronApi.shortcuts.loadKeybindings();
    if (!result || !result.success) {
      throw new Error(result?.error || 'Failed to load keybindings');
    }
    return result.data as Keybinding[];
  },

  /**
   * 保存快捷键配置
   */
  async saveKeybindings(keybindings: Keybinding[]): Promise<Keybinding[]> {
    const result = await electronApi.shortcuts.saveKeybindings(keybindings);
    if (!result || !result.success) {
      throw new Error(result?.error || 'Failed to save keybindings');
    }
    return result.data as Keybinding[];
  },

  /**
   * 添加快捷键绑定
   */
  async addKeybinding(commandId: string, key: string, when?: string | null): Promise<Keybinding[]> {
    const result = await electronApi.shortcuts.addKeybinding({
      commandId,
      key,
      when,
    });
    if (!result || !result.success) {
      throw new Error(result?.error || 'Failed to add keybinding');
    }
    return result.data as Keybinding[];
  },

  /**
   * 删除快捷键绑定
   */
  async removeKeybinding(commandId: string, key: string): Promise<Keybinding[]> {
    const result = await electronApi.shortcuts.removeKeybinding({
      commandId,
      key,
    });
    if (!result || !result.success) {
      throw new Error(result?.error || 'Failed to remove keybinding');
    }
    return result.data as Keybinding[];
  },

  /**
   * 重置为默认快捷键
   */
  async resetToDefaults(): Promise<Keybinding[]> {
    const result = await electronApi.shortcuts.resetToDefaults();
    if (!result || !result.success) {
      throw new Error(result?.error || 'Failed to reset keybindings');
    }
    return result.data as Keybinding[];
  },

  async confirmResetToDefaults(): Promise<boolean> {
    const result = await electronApi.shortcuts.confirmResetToDefaults();
    if (!result || !result.success) {
      throw new Error(result?.error || 'Failed to confirm reset keybindings');
    }
    return Boolean(result.data);
  },

  /**
   * 检测快捷键冲突
   */
  async detectConflicts(key: string, excludeCommandId?: string): Promise<KeybindingConflict[]> {
    const result = await electronApi.shortcuts.detectConflicts({
      key,
      excludeCommandId,
    });
    if (!result || !result.success) {
      throw new Error(result?.error || 'Failed to detect conflicts');
    }
    return result.data as KeybindingConflict[];
  },

  /**
   * 验证快捷键格式
   */
  async validateKeybinding(key: string): Promise<boolean> {
    const result = await electronApi.shortcuts.validateKeybinding(key);
    if (!result || !result.success) {
      throw new Error(result?.error || 'Failed to validate keybinding');
    }
    return result.data as boolean;
  },

  /**
   * 规范化快捷键格式
   */
  async normalizeKeybinding(key: string): Promise<string> {
    const result = await electronApi.shortcuts.normalizeKeybinding(key);
    if (!result || !result.success) {
      throw new Error(result?.error || 'Failed to normalize keybinding');
    }
    return result.data as string;
  },

  /**
   * 获取命令的快捷键
   */
  async getKeybindingsForCommand(commandId: string): Promise<Keybinding[]> {
    const result = await electronApi.shortcuts.getKeybindingsForCommand(commandId);
    if (!result || !result.success) {
      throw new Error(result?.error || 'Failed to get keybindings for command');
    }
    return result.data as Keybinding[];
  },

  /**
   * 导出快捷键配置
   */
  async exportKeybindings(): Promise<KeybindingsConfig> {
    const result = await electronApi.shortcuts.exportKeybindings();
    if (!result || !result.success) {
      throw new Error(result?.error || 'Failed to export keybindings');
    }
    return result.data as KeybindingsConfig;
  },

  /**
   * 导入快捷键配置
   */
  async importKeybindings(config: KeybindingsConfig): Promise<Keybinding[]> {
    const result = await electronApi.shortcuts.importKeybindings(config);
    if (!result || !result.success) {
      throw new Error(result?.error || 'Failed to import keybindings');
    }
    return result.data as Keybinding[];
  },
};
