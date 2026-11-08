export interface KeybindingEvent {
  key: string;
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

const SPECIAL_KEYS: Record<string, string> = {
  ' ': 'Space', Escape: 'Escape', Enter: 'Enter', Tab: 'Tab', Backspace: 'Backspace',
  Delete: 'Delete', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
  Insert: 'Insert', Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown',
};

export function normalizeKeybinding(keybinding: string, isMac: boolean): string {
  const parts = keybinding.split('+').map((part) => part.trim());
  const key = parts.pop() ?? '';
  const modifiers = new Set(parts.map((part) => {
    switch (part.toLowerCase()) {
      case 'commandorcontrol': case 'cmdorctrl': return isMac ? 'Command' : 'Control';
      case 'command': case 'cmd': return 'Command';
      case 'control': case 'ctrl': return 'Control';
      case 'meta': case 'super': return isMac ? 'Command' : 'Super';
      case 'option': case 'alt': return 'Alt';
      case 'shift': return 'Shift';
      default: return part;
    }
  }));
  return [...modifiers].sort().concat(key.length === 1 ? key.toUpperCase() : key).join('+');
}

export function buildKeybinding(event: KeybindingEvent, isMac: boolean): string {
  const parts: string[] = [];
  if (event.ctrlKey) parts.push(isMac ? 'Control' : 'CommandOrControl');
  if (event.metaKey) parts.push(isMac ? 'CommandOrControl' : 'Super');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  if (!['Control', 'Alt', 'Shift', 'Meta', 'Command'].includes(event.key)) {
    // Option and Shift may change event.key; letter shortcuts use the physical key.
    const key = /^Key[A-Z]$/.test(event.code) ? event.code.slice(3)
      : SPECIAL_KEYS[event.key] ?? (event.key.length === 1 ? event.key.toUpperCase() : event.key);
    parts.push(key);
  }
  return parts.join('+');
}
