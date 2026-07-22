import {
  app,
  globalShortcut,
  BrowserWindow,
  dialog,
  type MessageBoxOptions,
  type MessageBoxReturnValue,
} from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { VFS_CONSTANTS } from '../constants/vfs.constants.js';
import { COMMANDS, COMMAND_SCOPES, getAllCommands } from '../constants/commands.constants.js';
import { $t } from '../utils/i18n.js';
import { loggerService } from './logger.service.js';
import { getErrorCode, getErrorMessage } from '../services/error.service.js';

const logger = loggerService.createLogger('Electron:Shortcuts Service');

const KEYBINDINGS_CONFIG_VERSION = '1.1.0';

export interface ShortcutKeybinding {
  commandId: string;
  key: string;
  when: string | null;
}

interface ImportedKeybindingConfig {
  version?: string;
  keybindings: ShortcutKeybinding[];
}

export interface GlobalShortcutStatus {
  commandId: string;
  registeredAccelerators: string[];
  failedAccelerators: string[];
}

type GlobalCommandHandler = (commandId: string) => void;

let globalCommandHandler: GlobalCommandHandler | null = null;
const registeredGlobalAccelerators = new Set<string>();
let globalShortcutStatuses: GlobalShortcutStatus[] = [];

function getFocusedWindow(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;
}

async function showMessageBox(options: MessageBoxOptions): Promise<MessageBoxReturnValue> {
  const focusedWindow = getFocusedWindow();
  return focusedWindow
    ? dialog.showMessageBox(focusedWindow, options)
    : dialog.showMessageBox(options);
}

export const shortcutsService = {
  getShortcutsPath(): string {
    return path.join(app.getPath(VFS_CONSTANTS.USER_DATA), 'keybindings.json');
  },

  getDefaultKeybindings(): ShortcutKeybinding[] {
    const commands = getAllCommands();
    return commands
      .filter(cmd => cmd.defaultKeybinding)
      .map((cmd) => {
        const whenValue = (cmd as { when?: string | null }).when;
        return {
          commandId: cmd.id,
          key: String(cmd.defaultKeybinding ?? ''),
          when: typeof whenValue === 'string' ? whenValue : null,
        };
      })
      .filter((keybinding) => keybinding.key.trim().length > 0);
  },

  async loadKeybindings(): Promise<ShortcutKeybinding[]> {
    const filePath = this.getShortcutsPath();
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content) as { version?: string; keybindings?: ShortcutKeybinding[] };
      const keybindings = parsed.keybindings || this.getDefaultKeybindings();
      if (
        parsed.version !== KEYBINDINGS_CONFIG_VERSION
        && !keybindings.some(keybinding => keybinding.commandId === COMMANDS.APP_QUICK_CAPTURE.id)
      ) {
        const quickCaptureDefault = this.getDefaultKeybindings()
          .find(keybinding => keybinding.commandId === COMMANDS.APP_QUICK_CAPTURE.id);
        return quickCaptureDefault ? [...keybindings, quickCaptureDefault] : keybindings;
      }
      return keybindings;
    } catch (error: unknown) {
      if (getErrorCode(error) !== 'ENOENT') {
        logger.error('Failed to load keybindings', { error: getErrorMessage(error) });
      }
      return this.getDefaultKeybindings();
    }
  },

  async saveKeybindings(keybindings: ShortcutKeybinding[]): Promise<ShortcutKeybinding[]> {
    const filePath = this.getShortcutsPath();
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      const config = {
        version: KEYBINDINGS_CONFIG_VERSION,
        keybindings,
      };
      await fs.writeFile(filePath, JSON.stringify(config, null, 2), 'utf-8');
      await this.refreshGlobalShortcuts(keybindings);
      return keybindings;
    } catch (error: unknown) {
      logger.error('Failed to save keybindings', { error: getErrorMessage(error) });
      throw error;
    }
  },

  async addKeybinding(commandId: string, key: string, when: string | null = null): Promise<ShortcutKeybinding[]> {
    const keybindings = await this.loadKeybindings();

    const existingIndex = keybindings.findIndex((kb: ShortcutKeybinding) =>
      kb.commandId === commandId && kb.key === key
    );

    if (existingIndex >= 0) {
      keybindings[existingIndex] = { commandId, key, when };
    } else {
      keybindings.push({ commandId, key, when });
    }

    return await this.saveKeybindings(keybindings);
  },

  async removeKeybinding(commandId: string, key: string): Promise<ShortcutKeybinding[]> {
    const keybindings = await this.loadKeybindings();
    const filtered = keybindings.filter((kb: ShortcutKeybinding) =>
      !(kb.commandId === commandId && kb.key === key)
    );
    return await this.saveKeybindings(filtered);
  },

  async resetToDefaults(): Promise<ShortcutKeybinding[]> {
    const defaults = this.getDefaultKeybindings();
    return await this.saveKeybindings(defaults);
  },

  async confirmResetToDefaults(): Promise<boolean> {
    const dialogResult = await showMessageBox({
      type: 'warning',
      buttons: [$t('button.cancel'), $t('shortcuts.resetToDefaults')],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
      title: $t('shortcuts.title'),
      message: $t('shortcuts.resetConfirm'),
    });
    // selectedButtonIndex is zero-based and follows the order of buttons[]
    const selectedButtonIndex = dialogResult.response;

    return selectedButtonIndex === 1;
  },

  async detectConflicts(key: string, excludeCommandId: string | null = null): Promise<ShortcutKeybinding[]> {
    const keybindings = await this.loadKeybindings();
    return keybindings.filter((kb: ShortcutKeybinding) =>
      kb.key === key && kb.commandId !== excludeCommandId
    );
  },

  validateKeybinding(key: string): boolean {
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

  normalizeKeybinding(key: string): string {
    if (!key) return '';

    return key
      .replace(/CmdOrCtrl/gi, 'CommandOrControl')
      .replace(/Cmd(?!\w)/gi, 'Command')
      .replace(/Ctrl(?!\w)/gi, 'Control')
      .split('+')
      .map((part: string) => part.trim())
      .join('+');
  },

  registerGlobalShortcut(accelerator: string, callback: () => void): boolean {
    try {
      const success = globalShortcut.register(accelerator, callback);
      if (!success) {
        logger.warn('Failed to register global shortcut', { accelerator });
      }
      return success;
    } catch (error: unknown) {
      logger.error('Error registering global shortcut', {
        accelerator,
        error: getErrorMessage(error),
      });
      return false;
    }
  },

  unregisterGlobalShortcut(accelerator: string): void {
    try {
      globalShortcut.unregister(accelerator);
    } catch (error: unknown) {
      logger.error('Error unregistering global shortcut', {
        accelerator,
        error: getErrorMessage(error),
      });
    }
  },

  unregisterAllGlobalShortcuts(): void {
    globalShortcut.unregisterAll();
  },

  setGlobalCommandHandler(handler: GlobalCommandHandler): void {
    globalCommandHandler = handler;
  },

  async refreshGlobalShortcuts(keybindings?: ShortcutKeybinding[]): Promise<GlobalShortcutStatus[]> {
    for (const accelerator of registeredGlobalAccelerators) {
      this.unregisterGlobalShortcut(accelerator);
    }
    registeredGlobalAccelerators.clear();

    const currentKeybindings = keybindings ?? await this.loadKeybindings();
    const globalCommands = getAllCommands().filter(command => command.scope === COMMAND_SCOPES.GLOBAL);
    const nextStatuses: GlobalShortcutStatus[] = [];

    for (const command of globalCommands) {
      const registeredAccelerators: string[] = [];
      const failedAccelerators: string[] = [];
      const accelerators = Array.from(new Set(
        currentKeybindings
          .filter(keybinding => keybinding.commandId === command.id)
          .map(keybinding => this.normalizeKeybinding(keybinding.key))
          .filter(accelerator => accelerator.length > 0)
      ));

      for (const accelerator of accelerators) {
        const registered = this.validateKeybinding(accelerator)
          && this.registerGlobalShortcut(accelerator, () => {
            globalCommandHandler?.(command.id);
          });

        if (registered) {
          registeredGlobalAccelerators.add(accelerator);
          registeredAccelerators.push(accelerator);
        } else {
          failedAccelerators.push(accelerator);
        }
      }

      nextStatuses.push({
        commandId: command.id,
        registeredAccelerators,
        failedAccelerators,
      });
    }

    globalShortcutStatuses = nextStatuses;
    return this.getGlobalShortcutStatuses();
  },

  getGlobalShortcutStatuses(): GlobalShortcutStatus[] {
    return globalShortcutStatuses.map(status => ({
      commandId: status.commandId,
      registeredAccelerators: [...status.registeredAccelerators],
      failedAccelerators: [...status.failedAccelerators],
    }));
  },

  destroyGlobalShortcuts(): void {
    for (const accelerator of registeredGlobalAccelerators) {
      this.unregisterGlobalShortcut(accelerator);
    }
    registeredGlobalAccelerators.clear();
    globalShortcutStatuses = [];
    globalCommandHandler = null;
  },

  async getKeybindingsForCommand(commandId: string): Promise<ShortcutKeybinding[]> {
    const keybindings = await this.loadKeybindings();
    return keybindings.filter((kb: ShortcutKeybinding) => kb.commandId === commandId);
  },

  async exportKeybindings(): Promise<{ version: string; exportDate: string; keybindings: ShortcutKeybinding[] }> {
    const keybindings = await this.loadKeybindings();
    return {
      version: KEYBINDINGS_CONFIG_VERSION,
      exportDate: new Date().toISOString(),
      keybindings,
    };
  },

  async importKeybindings(config: ImportedKeybindingConfig): Promise<ShortcutKeybinding[]> {
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

    const keybindings = config.version === KEYBINDINGS_CONFIG_VERSION
      || config.keybindings.some(keybinding => keybinding.commandId === COMMANDS.APP_QUICK_CAPTURE.id)
      ? config.keybindings
      : [
          ...config.keybindings,
          ...this.getDefaultKeybindings()
            .filter(keybinding => keybinding.commandId === COMMANDS.APP_QUICK_CAPTURE.id),
        ];

    return await this.saveKeybindings(keybindings);
  },
};
