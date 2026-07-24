import {
  electronApi,
  type GlobalShortcutStatusPayload,
  type JsonValue,
} from '@renderer/core/bridge/electronApi';
import type {
  Command,
  GlobalShortcutStatus,
  Keybinding,
  KeybindingsConfig,
  KeybindingConflict,
} from '../store/shortcuts.store';

type ShortcutRecord = Record<string, JsonValue>;

interface IpcResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

function ensureIpcSuccess<T>(result: IpcResult<T> | null | undefined, fallbackMessage: string): T {
  if (!result || !result.success) {
    throw new Error(result?.error || fallbackMessage);
  }

  if (result.data === undefined) {
    throw new Error(fallbackMessage);
  }

  return result.data;
}

function toStringValue(value: JsonValue | undefined): string {
  return typeof value === 'string' ? value : '';
}

function toOptionalStringValue(value: JsonValue | undefined): string | null {
  return typeof value === 'string' ? value : null;
}

function toBooleanValue(value: JsonValue | undefined): boolean {
  return typeof value === 'boolean' ? value : false;
}

function normalizeCommandCategory(value: JsonValue | undefined): Command['category'] {
  switch (value) {
    case 'file':
    case 'edit':
    case 'view':
    case 'search':
    case 'app':
      return value as Command['category'];
    default:
      return 'app' as Command['category'];
  }
}

function normalizeCommandScope(value: JsonValue | undefined): Command['scope'] {
  return value === 'global' ? 'global' : 'renderer';
}

function normalizeKeybindingRecord(record: ShortcutRecord): Keybinding {
  return {
    commandId: toStringValue(record.commandId),
    key: toStringValue(record.key),
    when: toOptionalStringValue(record.when),
  };
}

function normalizeCommandRecord(record: ShortcutRecord): Command {
  return {
    id: toStringValue(record.id),
    category: normalizeCommandCategory(record.category),
    scope: normalizeCommandScope(record.scope),
    defaultKeybinding: toOptionalStringValue(record.defaultKeybinding),
  };
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
}

function normalizeGlobalShortcutStatusRecord(record: GlobalShortcutStatusPayload): GlobalShortcutStatus {
  return {
    commandId: typeof record.commandId === 'string' ? record.commandId : '',
    registeredAccelerators: normalizeStringArray(record.registeredAccelerators),
    failedAccelerators: normalizeStringArray(record.failedAccelerators),
  };
}

function normalizeConflictRecord(record: ShortcutRecord): KeybindingConflict {
  return {
    commandId: toStringValue(record.commandId),
    key: toStringValue(record.key),
    when: toOptionalStringValue(record.when),
  };
}

function normalizeKeybindings(records: ShortcutRecord[]): Keybinding[] {
  return records.map(normalizeKeybindingRecord);
}

function normalizeCommands(records: ShortcutRecord[]): Command[] {
  return records.map(normalizeCommandRecord);
}

function normalizeConflicts(records: ShortcutRecord[]): KeybindingConflict[] {
  return records.map(normalizeConflictRecord);
}

function normalizeKeybindingsConfig(data: {
  version: string;
  keybindings: Array<{ commandId: string; key: string; when?: string | null }>;
}): KeybindingsConfig {
  return {
    version: String(data.version || '1.0.0'),
    keybindings: data.keybindings.map((item) => ({
      commandId: String(item.commandId || ''),
      key: String(item.key || ''),
      when: typeof item.when === 'string' ? item.when : null,
    })),
  };
}

export const shortcutsService = {
  async getCommands(): Promise<Command[]> {
    const result = await electronApi.shortcuts.getCommands();
    return normalizeCommands(ensureIpcSuccess(result, 'Failed to get commands'));
  },

  async getCommandsByCategory(category: string): Promise<Command[]> {
    const result = await electronApi.shortcuts.getCommandsByCategory(category);
    return normalizeCommands(ensureIpcSuccess(result, 'Failed to get commands by category'));
  },

  async loadKeybindings(): Promise<Keybinding[]> {
    const result = await electronApi.shortcuts.loadKeybindings();
    return normalizeKeybindings(ensureIpcSuccess(result, 'Failed to load keybindings'));
  },

  async getGlobalShortcutStatuses(): Promise<GlobalShortcutStatus[]> {
    const result = await electronApi.shortcuts.getGlobalShortcutStatuses();
    const statuses = ensureIpcSuccess(result, 'Failed to get global shortcut status');
    return statuses.map(status => normalizeGlobalShortcutStatusRecord(status));
  },

  async saveKeybindings(keybindings: Keybinding[]): Promise<Keybinding[]> {
    const result = await electronApi.shortcuts.saveKeybindings(keybindings);
    return normalizeKeybindings(ensureIpcSuccess(result, 'Failed to save keybindings'));
  },

  async addKeybinding(commandId: string, key: string, when?: string | null): Promise<Keybinding[]> {
    const result = await electronApi.shortcuts.addKeybinding({
      commandId,
      key,
      when,
    });
    return normalizeKeybindings(ensureIpcSuccess(result, 'Failed to add keybinding'));
  },

  async removeKeybinding(commandId: string, key: string): Promise<Keybinding[]> {
    const result = await electronApi.shortcuts.removeKeybinding({
      commandId,
      key,
    });
    return normalizeKeybindings(ensureIpcSuccess(result, 'Failed to remove keybinding'));
  },

  async resetToDefaults(): Promise<Keybinding[]> {
    const result = await electronApi.shortcuts.resetToDefaults();
    return normalizeKeybindings(ensureIpcSuccess(result, 'Failed to reset keybindings'));
  },

  async confirmResetToDefaults(): Promise<boolean> {
    const result = await electronApi.shortcuts.confirmResetToDefaults();
    return toBooleanValue(ensureIpcSuccess(result, 'Failed to confirm reset keybindings'));
  },

  async detectConflicts(key: string, excludeCommandId?: string): Promise<KeybindingConflict[]> {
    const result = await electronApi.shortcuts.detectConflicts({
      key,
      excludeCommandId,
    });
    return normalizeConflicts(ensureIpcSuccess(result, 'Failed to detect conflicts'));
  },

  async validateKeybinding(key: string): Promise<boolean> {
    const result = await electronApi.shortcuts.validateKeybinding(key);
    return toBooleanValue(ensureIpcSuccess(result, 'Failed to validate keybinding'));
  },

  async normalizeKeybinding(key: string): Promise<string> {
    const result = await electronApi.shortcuts.normalizeKeybinding(key);
    return toStringValue(ensureIpcSuccess(result, 'Failed to normalize keybinding'));
  },

  async getKeybindingsForCommand(commandId: string): Promise<Keybinding[]> {
    const result = await electronApi.shortcuts.getKeybindingsForCommand(commandId);
    return normalizeKeybindings(ensureIpcSuccess(result, 'Failed to get keybindings for command'));
  },

  async exportKeybindings(): Promise<KeybindingsConfig> {
    const result = await electronApi.shortcuts.exportKeybindings();
    return normalizeKeybindingsConfig(ensureIpcSuccess(result, 'Failed to export keybindings'));
  },

  async importKeybindings(config: KeybindingsConfig): Promise<Keybinding[]> {
    const result = await electronApi.shortcuts.importKeybindings(config);
    return normalizeKeybindings(ensureIpcSuccess(result, 'Failed to import keybindings'));
  },
};
