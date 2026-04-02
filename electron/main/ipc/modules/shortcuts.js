import { ipcMain } from 'electron';
import { shortcutsService } from '../../services/shortcuts.service.js';
import { getAllCommands, getCommandsByCategory } from '../../constants/commands.constants.js';

/**
 * 注册快捷键相关的 IPC 处理器
 */
export function registerShortcutsHandlers() {
  // 获取所有命令
  ipcMain.handle('shortcuts:get-commands', async () => {
    try {
      return {
        success: true,
        data: getAllCommands(),
      };
    } catch (error) {
      console.error('Failed to get commands:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // 根据分类获取命令
  ipcMain.handle('shortcuts:get-commands-by-category', async (_event, category) => {
    try {
      return {
        success: true,
        data: getCommandsByCategory(category),
      };
    } catch (error) {
      console.error('Failed to get commands by category:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // 加载快捷键配置
  ipcMain.handle('shortcuts:load-keybindings', async () => {
    try {
      const keybindings = await shortcutsService.loadKeybindings();
      return {
        success: true,
        data: keybindings,
      };
    } catch (error) {
      console.error('Failed to load keybindings:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // 保存快捷键配置
  ipcMain.handle('shortcuts:save-keybindings', async (_event, keybindings) => {
    try {
      const saved = await shortcutsService.saveKeybindings(keybindings);
      return {
        success: true,
        data: saved,
      };
    } catch (error) {
      console.error('Failed to save keybindings:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // 添加快捷键绑定
  ipcMain.handle('shortcuts:add-keybinding', async (_event, { commandId, key, when }) => {
    try {
      const keybindings = await shortcutsService.addKeybinding(commandId, key, when);
      return {
        success: true,
        data: keybindings,
      };
    } catch (error) {
      console.error('Failed to add keybinding:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // 删除快捷键绑定
  ipcMain.handle('shortcuts:remove-keybinding', async (_event, { commandId, key }) => {
    try {
      const keybindings = await shortcutsService.removeKeybinding(commandId, key);
      return {
        success: true,
        data: keybindings,
      };
    } catch (error) {
      console.error('Failed to remove keybinding:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // 重置为默认快捷键
  ipcMain.handle('shortcuts:reset-to-defaults', async () => {
    try {
      const keybindings = await shortcutsService.resetToDefaults();
      return {
        success: true,
        data: keybindings,
      };
    } catch (error) {
      console.error('Failed to reset keybindings:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // 检测快捷键冲突
  ipcMain.handle('shortcuts:detect-conflicts', async (_event, { key, excludeCommandId }) => {
    try {
      const conflicts = await shortcutsService.detectConflicts(key, excludeCommandId);
      return {
        success: true,
        data: conflicts,
      };
    } catch (error) {
      console.error('Failed to detect conflicts:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // 验证快捷键格式
  ipcMain.handle('shortcuts:validate-keybinding', async (_event, key) => {
    try {
      const isValid = shortcutsService.validateKeybinding(key);
      return {
        success: true,
        data: isValid,
      };
    } catch (error) {
      console.error('Failed to validate keybinding:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // 规范化快捷键格式
  ipcMain.handle('shortcuts:normalize-keybinding', async (_event, key) => {
    try {
      const normalized = shortcutsService.normalizeKeybinding(key);
      return {
        success: true,
        data: normalized,
      };
    } catch (error) {
      console.error('Failed to normalize keybinding:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // 获取命令的快捷键
  ipcMain.handle('shortcuts:get-keybindings-for-command', async (_event, commandId) => {
    try {
      const keybindings = await shortcutsService.getKeybindingsForCommand(commandId);
      return {
        success: true,
        data: keybindings,
      };
    } catch (error) {
      console.error('Failed to get keybindings for command:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // 导出快捷键配置
  ipcMain.handle('shortcuts:export-keybindings', async () => {
    try {
      const config = await shortcutsService.exportKeybindings();
      return {
        success: true,
        data: config,
      };
    } catch (error) {
      console.error('Failed to export keybindings:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // 导入快捷键配置
  ipcMain.handle('shortcuts:import-keybindings', async (_event, config) => {
    try {
      const keybindings = await shortcutsService.importKeybindings(config);
      return {
        success: true,
        data: keybindings,
      };
    } catch (error) {
      console.error('Failed to import keybindings:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });
}
