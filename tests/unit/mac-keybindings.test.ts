import { buildKeybinding, normalizeKeybinding, type KeybindingEvent } from '../../electron/shared/utils/keybinding.utils';
import { keyboardService } from '@renderer/features/shortcuts/services/keyboard.service';

const mocks = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock('@renderer/features/shortcuts/services/command.service', () => ({ commandService: { executeCommand: mocks.execute } }));

function keyEvent(modifiers: Partial<KeybindingEvent> = {}): KeybindingEvent {
  return { key: 'h', code: 'KeyH', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...modifiers };
}

describe('platform keybindings', () => {
  afterEach(() => { keyboardService.stopListening(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

  it('records Mac Control, Command and their combination separately', () => {
    expect(buildKeybinding(keyEvent({ ctrlKey: true }), true)).toBe('Control+H');
    expect(buildKeybinding(keyEvent({ metaKey: true }), true)).toBe('CommandOrControl+H');
    expect(buildKeybinding(keyEvent({ ctrlKey: true, metaKey: true }), true)).toBe('Control+CommandOrControl+H');
  });

  it('matches platform defaults and explicit modifier aliases correctly', () => {
    expect(normalizeKeybinding('CmdOrCtrl+H', true)).toBe(normalizeKeybinding('Command+H', true));
    expect(normalizeKeybinding('CmdOrCtrl+H', true)).not.toBe(normalizeKeybinding('Control+H', true));
    expect(normalizeKeybinding('CmdOrCtrl+H', false)).toBe(normalizeKeybinding('Ctrl+H', false));
    expect(normalizeKeybinding('Shift+Cmd+H', true)).toBe(normalizeKeybinding('CommandOrControl+Shift+H', true));
  });

  it('preserves Windows Control defaults and distinguishes the Windows key', () => {
    expect(buildKeybinding(keyEvent({ ctrlKey: true }), false)).toBe('CommandOrControl+H');
    expect(normalizeKeybinding(buildKeybinding(keyEvent({ metaKey: true }), false), false))
      .not.toBe(normalizeKeybinding('CommandOrControl+H', false));
  });

  it('recognizes a Mac Option shortcut when the generated character changes', () => {
    expect(buildKeybinding(keyEvent({ key: '˙', altKey: true, metaKey: true }), true)).toBe('CommandOrControl+Alt+H');
  });

  it('dispatches Mac Control and Command shortcuts to different commands', () => {
    let onKeyDown: (event: KeyboardEvent) => void = () => {};
    vi.stubGlobal('navigator', { platform: 'MacIntel' });
    vi.stubGlobal('window', {
      addEventListener: (_type: string, listener: (event: KeyboardEvent) => void) => { onKeyDown = listener; },
      removeEventListener: vi.fn(),
    });
    keyboardService.setKeybindings([
      { commandId: 'control', key: 'Control+H' },
      { commandId: 'command', key: 'CommandOrControl+H' },
    ]);
    keyboardService.startListening();
    onKeyDown({ ...keyEvent({ ctrlKey: true }), preventDefault: vi.fn(), stopPropagation: vi.fn() } as KeyboardEvent);
    onKeyDown({ ...keyEvent({ metaKey: true }), preventDefault: vi.fn(), stopPropagation: vi.fn() } as KeyboardEvent);
    expect(mocks.execute.mock.calls).toEqual([['control'], ['command']]);
  });
});
