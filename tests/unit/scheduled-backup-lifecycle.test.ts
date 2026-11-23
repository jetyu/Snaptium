import { reactive, nextTick } from 'vue';
import { useScheduledBackupLifecycle } from '@renderer/features/settings/composables/useScheduledBackupLifecycle';

const mocks = vi.hoisted(() => ({ backup: vi.fn(), flush: vi.fn(), stop: vi.fn() }));
vi.mock('vue', async (importOriginal) => ({
  ...await importOriginal<typeof import('vue')>(),
  onUnmounted: (stop: () => void) => { mocks.stop.mockImplementation(stop); },
}));
const state = reactive({
  config: { noteStorage: { scheduledBackup: {
    enabled: true, directoryPath: 'backup', intervalHours: 1, retentionCount: 5, lastBackupAt: null as number | null,
  } } },
  scheduledBackupError: null as string | null,
  scheduledBackupRunning: false,
  scheduledBackupRetryRequest: 0,
  noteStorage: { updateScheduledBackup: async (value: { lastBackupAt: number }) => {
    state.config.noteStorage.scheduledBackup.lastBackupAt = value.lastBackupAt;
  } },
});
vi.mock('@renderer/features/settings/store/settings.store', () => ({ useSettingsStore: () => state }));
vi.mock('@renderer/features/workspace/store/workspace.store', () => ({ useWorkspaceStore: () => ({ forceFlushAutoSave: mocks.flush }) }));
vi.mock('@renderer/features/settings/services/settings.service', () => ({ settingsService: { createScheduledBackup: mocks.backup } }));
vi.mock('@renderer/features/i18n', () => ({ i18n: { global: { t: (key: string) => key } } }));
vi.mock('@renderer/features/logger', () => ({ createLogger: () => ({ error: vi.fn() }) }));

describe('scheduled backup feedback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('window', globalThis);
    state.config.noteStorage.scheduledBackup.lastBackupAt = null;
    state.scheduledBackupError = null;
    state.scheduledBackupRetryRequest = 0;
    mocks.flush.mockReset().mockResolvedValue(undefined);
    mocks.backup.mockReset().mockResolvedValue({ success: true, backedUpAt: Date.now() });
  });
  afterEach(() => {
    mocks.stop();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('shows errors and permits immediate retry before the automatic retry delay', async () => {
    mocks.backup.mockRejectedValueOnce(new Error('disk disconnected'));
    useScheduledBackupLifecycle().setupScheduledBackup();
    await vi.advanceTimersByTimeAsync(0);
    expect(state.scheduledBackupError).toBe('disk disconnected');
    expect(state.scheduledBackupRunning).toBe(false);
    state.scheduledBackupRetryRequest++;
    await nextTick();
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.backup).toHaveBeenCalledTimes(2);
    expect(state.scheduledBackupError).toBeNull();
    expect(state.config.noteStorage.scheduledBackup.lastBackupAt).not.toBeNull();
  });

  it('does not create a backup when flushing unsaved notes fails', async () => {
    mocks.flush.mockRejectedValue(new Error('unsaved note'));
    useScheduledBackupLifecycle().setupScheduledBackup();
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.backup).not.toHaveBeenCalled();
    expect(state.scheduledBackupError).toBe('unsaved note');
  });
});
