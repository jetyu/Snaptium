import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  activeRequestListener: null as (() => void) | null,
  accessControlListener: null as ((payload: { locked: boolean }) => void) | null,
  locked: true,
  createNote: vi.fn(async () => ({ id: 'quick-note' })),
  dispatch: vi.fn(),
  focus: vi.fn(),
  markReady: vi.fn(),
  setActiveMainView: vi.fn(async () => undefined),
  showError: vi.fn(async () => undefined),
}));

vi.mock('@codemirror/view', () => ({
  EditorView: class {
    static scrollIntoView(position: number): { position: number } {
      return { position };
    }
  },
}));

vi.mock('@renderer/core/bridge/electronApi', () => ({
  electronApi: {
    quickCapture: {
      isAvailable: () => true,
      markReady: mocks.markReady,
      onRequested: (callback: () => void) => {
        mocks.activeRequestListener = callback;
        return () => {
          mocks.activeRequestListener = null;
        };
      },
    },
  },
}));

vi.mock('@renderer/app/store/appShell.store', () => ({
  useAppShellStore: () => ({ setActiveMainView: mocks.setActiveMainView }),
}));

vi.mock('@renderer/features/editor/composables/useEditor', () => ({
  useEditor: () => ({
    getEditorView: () => ({
      state: { doc: { length: 12 } },
      dispatch: mocks.dispatch,
      focus: mocks.focus,
    }),
  }),
}));

vi.mock('@renderer/features/i18n', () => ({
  i18n: {
    global: {
      t: (key: string) => key === 'quickCapture.noteTitlePrefix' ? '快速记录' : key,
    },
  },
}));

vi.mock('@renderer/features/logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

vi.mock('@renderer/features/security/services/security.service', () => ({
  securityService: {
    isAccessControlAvailable: () => true,
    getAccessControlStatus: async () => ({
      config: { enabled: true },
      isLocked: mocks.locked,
    }),
    onAccessControlStateChanged: (callback: (payload: { locked: boolean }) => void) => {
      mocks.accessControlListener = callback;
      return () => {
        mocks.accessControlListener = null;
      };
    },
  },
}));

vi.mock('@renderer/features/settings/services/system-dialog.service', () => ({
  systemDialog: { error: mocks.showError },
}));

vi.mock('@renderer/features/workspace/store/workspace.store', () => ({
  useWorkspaceStore: () => ({ createNote: mocks.createNote }),
}));

import {
  formatQuickCaptureTimestamp,
  useQuickCapture,
} from '../../src/renderer/features/quick-capture/composables/useQuickCapture';

async function flushAsyncWork(): Promise<void> {
  await new Promise<void>(resolve => setTimeout(resolve, 0));
  await new Promise<void>(resolve => setTimeout(resolve, 0));
}

describe('renderer quick capture', () => {
  beforeEach(() => {
    mocks.activeRequestListener = null;
    mocks.accessControlListener = null;
    mocks.locked = true;
    vi.clearAllMocks();
  });

  it('formats a local timestamp to seconds', () => {
    expect(formatQuickCaptureTimestamp(new Date(2026, 6, 22, 9, 5, 7)))
      .toBe('2026-07-22 09:05:07');
  });

  it('coalesces startup and locked requests, then creates and focuses one note after unlock', async () => {
    const quickCapture = useQuickCapture();
    quickCapture.start();

    mocks.activeRequestListener?.();
    mocks.activeRequestListener?.();
    quickCapture.markApplicationReady();
    await flushAsyncWork();

    expect(mocks.markReady).toHaveBeenCalledTimes(1);
    expect(mocks.createNote).not.toHaveBeenCalled();

    mocks.locked = false;
    mocks.accessControlListener?.({ locked: false });
    await flushAsyncWork();

    expect(mocks.createNote).toHaveBeenCalledTimes(1);
    expect(mocks.createNote).toHaveBeenCalledWith(null, expect.stringMatching(/^快速记录 \d{4}-\d{2}-\d{2} /));
    expect(mocks.setActiveMainView).toHaveBeenCalledWith('workspace');
    expect(mocks.dispatch).toHaveBeenCalledWith(expect.objectContaining({ selection: { anchor: 12 } }));
    expect(mocks.focus).toHaveBeenCalledTimes(1);
    quickCapture.dispose();
  });
});
