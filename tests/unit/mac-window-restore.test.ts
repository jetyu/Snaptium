import type { BrowserWindow } from 'electron';
import { trayService } from '../../electron/main/services/tray.service';

vi.mock('electron', () => ({
  app: { getAppPath: () => '.' }, BrowserWindow: {},
  nativeImage: { createFromPath: () => ({ resize: () => ({}) }) },
  Tray: class {
    setToolTip() {} setContextMenu() {} on() {} destroy() {} setPressedImage() {}
  },
  Menu: { buildFromTemplate: () => ({}) },
}));
vi.mock('../../electron/main/utils/i18n.js', () => ({ $t: (key: string) => key }));
vi.mock('../../electron/main/services/log/logger.service.js', () => ({ loggerService: {
  createLogger: () => ({ debug: vi.fn() }),
} }));

describe('restoring the existing main window', () => {
  afterEach(() => { trayService.destroy(); });

  it('shows and focuses a hidden window without creating a replacement', () => {
    const window = { isDestroyed: () => false, isMinimized: () => false, isVisible: () => false,
      restore: vi.fn(), show: vi.fn(), focus: vi.fn() };
    trayService.init(window as BrowserWindow, () => {});
    trayService.showAndFocusMainWindow();
    expect(window.show).toHaveBeenCalledOnce();
    expect(window.focus).toHaveBeenCalledOnce();
    expect(window.restore).not.toHaveBeenCalled();
  });

  it('restores a minimized window before focusing it', () => {
    const window = { isDestroyed: () => false, isMinimized: () => true, isVisible: () => true,
      restore: vi.fn(), show: vi.fn(), focus: vi.fn() };
    trayService.init(window as BrowserWindow, () => {});
    trayService.showAndFocusMainWindow();
    expect(window.restore).toHaveBeenCalledOnce();
    expect(window.focus).toHaveBeenCalledOnce();
    expect(window.restore.mock.invocationCallOrder[0]).toBeLessThan(window.focus.mock.invocationCallOrder[0]);
  });
});
