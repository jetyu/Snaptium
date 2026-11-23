const mocks = vi.hoisted(() => ({ readFile: vi.fn() }));
vi.mock('electron', () => ({ app: { getPath: () => 'config' }, globalShortcut: {}, BrowserWindow: {}, dialog: {} }));
vi.mock('node:fs/promises', () => ({ default: { readFile: mocks.readFile } }));
vi.mock('../../electron/main/utils/i18n.js', () => ({ $t: (key: string) => key }));
vi.mock('../../electron/main/services/log/logger.service.js', () => ({ loggerService: {
  createLogger: () => ({ error: vi.fn(), warn: vi.fn() }),
} }));

describe('Mac history shortcut defaults', () => {
  const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')!;
  afterEach(() => { Object.defineProperty(process, 'platform', originalPlatform); vi.resetModules(); });

  async function loadService(platform: string) {
    Object.defineProperty(process, 'platform', { ...originalPlatform, value: platform });
    vi.resetModules();
    return (await import('../../electron/main/services/shortcuts.service')).shortcutsService;
  }

  it('uses Command Shift H on Mac and updates the old default on load', async () => {
    const service = await loadService('darwin');
    expect(service.getDefaultKeybindings().find((binding) => binding.commandId === 'file.history')?.key)
      .toBe('CommandOrControl+Shift+H');
    mocks.readFile.mockResolvedValue(JSON.stringify({ version: '1.1.0', keybindings: [
      { commandId: 'file.history', key: 'CommandOrControl+H', when: null },
    ] }));
    const bindings = await service.loadKeybindings();
    expect(bindings.find((binding) => binding.commandId === 'file.history')?.key).toBe('CommandOrControl+Shift+H');
  });

  it('preserves custom Mac history bindings and current-version choices', async () => {
    const service = await loadService('darwin');
    const custom = [{ commandId: 'file.history', key: 'Control+Alt+Y', when: null }];
    expect(service.migrateKeybindings(custom, '1.1.0')).toEqual(custom);
    const current = [{ commandId: 'file.history', key: 'CommandOrControl+H', when: null }];
    expect(service.migrateKeybindings(current, '1.2.0')).toEqual(current);
  });

  it('keeps the Windows history shortcut unchanged', async () => {
    const service = await loadService('win32');
    expect(service.getDefaultKeybindings().find((binding) => binding.commandId === 'file.history')?.key)
      .toBe('CommandOrControl+H');
    const bindings = [{ commandId: 'file.history', key: 'CommandOrControl+H', when: null }];
    expect(service.migrateKeybindings(bindings, '1.1.0')).toEqual(bindings);
  });
});
