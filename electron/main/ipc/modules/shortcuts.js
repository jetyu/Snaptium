import { ipcMain } from 'electron';
import { shortcutsService } from '../../services/shortcuts.service.js';
import { getAllCommands, getCommandsByCategory } from '../../constants/commands.constants.js';
import { IPC_CHANNELS } from '../../constants/ipc.constants.js';
import { loggerService } from '../../services/logger.service.js';

const logger = loggerService.createLogger('Electron:Shortcuts IPC');

export function registerShortcutsHandlers() {

  ipcMain.handle(IPC_CHANNELS.SHORTCUTS_GET_COMMANDS, async () => {
    try {
      return {
        success: true,
        data: getAllCommands(),
      };
    } catch (error) {
      logger.error('Failed to get commands', { error: error.message });
      return {
        success: false,
        error: error.message,
      };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SHORTCUTS_GET_COMMANDS_BY_CATEGORY, async (_event, category) => {
    try {
      return {
        success: true,
        data: getCommandsByCategory(category),
      };
    } catch (error) {
      logger.error('Failed to get commands by category', {
        category,
        error: error.message,
      });
      return {
        success: false,
        error: error.message,
      };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SHORTCUTS_LOAD_KEYBINDINGS, async () => {
    try {
      const keybindings = await shortcutsService.loadKeybindings();
      return {
        success: true,
        data: keybindings,
      };
    } catch (error) {
      logger.error('Failed to load keybindings', { error: error.message });
      return {
        success: false,
        error: error.message,
      };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SHORTCUTS_SAVE_KEYBINDINGS, async (_event, keybindings) => {
    try {
      const saved = await shortcutsService.saveKeybindings(keybindings);
      return {
        success: true,
        data: saved,
      };
    } catch (error) {
      logger.error('Failed to save keybindings', { error: error.message });
      return {
        success: false,
        error: error.message,
      };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SHORTCUTS_ADD_KEYBINDING, async (_event, { commandId, key, when }) => {
    try {
      const keybindings = await shortcutsService.addKeybinding(commandId, key, when);
      return {
        success: true,
        data: keybindings,
      };
    } catch (error) {
      logger.error('Failed to add keybinding', {
        commandId,
        key,
        error: error.message,
      });
      return {
        success: false,
        error: error.message,
      };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SHORTCUTS_REMOVE_KEYBINDING, async (_event, { commandId, key }) => {
    try {
      const keybindings = await shortcutsService.removeKeybinding(commandId, key);
      return {
        success: true,
        data: keybindings,
      };
    } catch (error) {
      logger.error('Failed to remove keybinding', {
        commandId,
        key,
        error: error.message,
      });
      return {
        success: false,
        error: error.message,
      };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SHORTCUTS_RESET_TO_DEFAULTS, async () => {
    try {
      const keybindings = await shortcutsService.resetToDefaults();
      return {
        success: true,
        data: keybindings,
      };
    } catch (error) {
      logger.error('Failed to reset keybindings', { error: error.message });
      return {
        success: false,
        error: error.message,
      };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SHORTCUTS_CONFIRM_RESET_TO_DEFAULTS, async () => {
    try {
      const confirmed = await shortcutsService.confirmResetToDefaults();
      return {
        success: true,
        data: confirmed,
      };
    } catch (error) {
      logger.error('Failed to confirm reset keybindings', { error: error.message });
      return {
        success: false,
        error: error.message,
      };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SHORTCUTS_DETECT_CONFLICTS, async (_event, { key, excludeCommandId }) => {
    try {
      const conflicts = await shortcutsService.detectConflicts(key, excludeCommandId);
      return {
        success: true,
        data: conflicts,
      };
    } catch (error) {
      logger.error('Failed to detect conflicts', {
        key,
        excludeCommandId,
        error: error.message,
      });
      return {
        success: false,
        error: error.message,
      };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SHORTCUTS_VALIDATE_KEYBINDING, async (_event, key) => {
    try {
      const isValid = shortcutsService.validateKeybinding(key);
      return {
        success: true,
        data: isValid,
      };
    } catch (error) {
      logger.error('Failed to validate keybinding', {
        key,
        error: error.message,
      });
      return {
        success: false,
        error: error.message,
      };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SHORTCUTS_NORMALIZE_KEYBINDING, async (_event, key) => {
    try {
      const normalized = shortcutsService.normalizeKeybinding(key);
      return {
        success: true,
        data: normalized,
      };
    } catch (error) {
      logger.error('Failed to normalize keybinding', {
        key,
        error: error.message,
      });
      return {
        success: false,
        error: error.message,
      };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SHORTCUTS_GET_KEYBINDINGS_FOR_COMMAND, async (_event, commandId) => {
    try {
      const keybindings = await shortcutsService.getKeybindingsForCommand(commandId);
      return {
        success: true,
        data: keybindings,
      };
    } catch (error) {
      logger.error('Failed to get keybindings for command', {
        commandId,
        error: error.message,
      });
      return {
        success: false,
        error: error.message,
      };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SHORTCUTS_EXPORT_KEYBINDINGS, async () => {
    try {
      const config = await shortcutsService.exportKeybindings();
      return {
        success: true,
        data: config,
      };
    } catch (error) {
      logger.error('Failed to export keybindings', { error: error.message });
      return {
        success: false,
        error: error.message,
      };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SHORTCUTS_IMPORT_KEYBINDINGS, async (_event, config) => {
    try {
      const keybindings = await shortcutsService.importKeybindings(config);
      return {
        success: true,
        data: keybindings,
      };
    } catch (error) {
      logger.error('Failed to import keybindings', { error: error.message });
      return {
        success: false,
        error: error.message,
      };
    }
  });
}
