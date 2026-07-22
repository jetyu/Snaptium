import { EventEmitter } from 'node:events';
import type { BrowserWindow } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const electronMocks = vi.hoisted(() => {
  class MockIpcMain {
    private readonly listeners = new Map<string, Set<(...args: unknown[]) => void>>();

    on(eventName: string, listener: (...args: unknown[]) => void): this {
      const eventListeners = this.listeners.get(eventName) ?? new Set();
      eventListeners.add(listener);
      this.listeners.set(eventName, eventListeners);
      return this;
    }

    removeListener(eventName: string, listener: (...args: unknown[]) => void): this {
      this.listeners.get(eventName)?.delete(listener);
      return this;
    }

    emit(eventName: string, ...args: unknown[]): boolean {
      const eventListeners = this.listeners.get(eventName);
      eventListeners?.forEach(listener => listener(...args));
      return (eventListeners?.size ?? 0) > 0;
    }
  }

  const ipcMain = new MockIpcMain();
  const callbacks = new Map<string, () => void>();
  const register = vi.fn((accelerator: string, callback: () => void) => {
    callbacks.set(accelerator, callback);
    return true;
  });
  return {
    callbacks,
    ipcMain,
    register,
    unregister: vi.fn(),
  };
});

vi.mock('electron', () => ({
  app: {
    getAppPath: () => process.cwd(),
    getLocale: () => 'zh-CN',
    getPath: () => process.cwd(),
    isPackaged: false,
  },
  BrowserWindow: class {},
  dialog: {
    showMessageBox: vi.fn(),
  },
  globalShortcut: {
    register: electronMocks.register,
    unregister: electronMocks.unregister,
    unregisterAll: vi.fn(),
  },
  ipcMain: electronMocks.ipcMain,
  shell: {
    openPath: vi.fn(),
  },
}));

vi.mock('../../electron/main/services/logger.service.js', () => ({
  loggerService: {
    createLogger: () => ({
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    }),
  },
}));

import { COMMANDS } from '../../electron/main/constants/commands.constants';
import { IPC_CHANNELS } from '../../electron/main/constants/ipc.constants';
import { QuickCaptureService } from '../../electron/main/services/quick-capture.service';
import { shortcutsService } from '../../electron/main/services/shortcuts.service';

class FakeWebContents extends EventEmitter {
  readonly send = vi.fn();

  isDestroyed(): boolean {
    return false;
  }
}

class FakeWindow extends EventEmitter {
  readonly webContents = new FakeWebContents();
  readonly restore = vi.fn();
  readonly show = vi.fn();
  readonly focus = vi.fn();

  isDestroyed(): boolean {
    return false;
  }

  isMinimized(): boolean {
    return true;
  }

  isVisible(): boolean {
    return false;
  }
}

describe('main-process quick capture', () => {
  beforeEach(() => {
    electronMocks.callbacks.clear();
    electronMocks.register.mockReset();
    electronMocks.register.mockImplementation((accelerator: string, callback: () => void) => {
      electronMocks.callbacks.set(accelerator, callback);
      return true;
    });
    electronMocks.unregister.mockReset();
    shortcutsService.destroyGlobalShortcuts();
  });

  it('coalesces requests until the renderer is ready', () => {
    const service = new QuickCaptureService();
    const window = new FakeWindow();
    service.initialize(window as unknown as BrowserWindow);

    service.request();
    service.request();

    expect(window.webContents.send).not.toHaveBeenCalled();
    electronMocks.ipcMain.emit(IPC_CHANNELS.QUICK_CAPTURE_READY, { sender: window.webContents });

    expect(window.restore).toHaveBeenCalled();
    expect(window.show).toHaveBeenCalled();
    expect(window.focus).toHaveBeenCalled();
    expect(window.webContents.send).toHaveBeenCalledTimes(1);
    expect(window.webContents.send).toHaveBeenCalledWith(IPC_CHANNELS.QUICK_CAPTURE_REQUESTED);
    service.destroy();
  });

  it('refreshes owned global shortcuts and reports registration failures', async () => {
    const handler = vi.fn();
    shortcutsService.setGlobalCommandHandler(handler);

    const registered = await shortcutsService.refreshGlobalShortcuts([{
      commandId: COMMANDS.APP_QUICK_CAPTURE.id,
      key: 'CommandOrControl+Alt+N',
      when: null,
    }]);

    expect(registered).toEqual([{
      commandId: COMMANDS.APP_QUICK_CAPTURE.id,
      registeredAccelerators: ['CommandOrControl+Alt+N'],
      failedAccelerators: [],
    }]);
    electronMocks.callbacks.get('CommandOrControl+Alt+N')?.();
    expect(handler).toHaveBeenCalledWith(COMMANDS.APP_QUICK_CAPTURE.id);

    electronMocks.register.mockReturnValue(false);
    const failed = await shortcutsService.refreshGlobalShortcuts([{
      commandId: COMMANDS.APP_QUICK_CAPTURE.id,
      key: 'CommandOrControl+Alt+M',
      when: null,
    }]);

    expect(electronMocks.unregister).toHaveBeenCalledWith('CommandOrControl+Alt+N');
    expect(failed[0]?.failedAccelerators).toEqual(['CommandOrControl+Alt+M']);
  });
});
