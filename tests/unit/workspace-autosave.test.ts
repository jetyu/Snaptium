import { createPinia, setActivePinia } from 'pinia';
import { useWorkspaceStore } from '@renderer/features/workspace/store/workspace.store';

const mocks = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock('@renderer/core/bridge/electronApi', () => ({ electronApi: {} }));
vi.mock('@renderer/core/markdown/markdownRenderer', () => ({ renderMarkdown: vi.fn() }));
vi.mock('@renderer/app/store/appShell.store', () => ({ useAppShellStore: vi.fn() }));
vi.mock('@renderer/features/i18n', () => ({ i18n: { global: { t: (key: string) => key } } }));
vi.mock('@renderer/features/logger', () => ({ createLogger: () => ({ error: vi.fn(), debug: vi.fn(), warn: vi.fn() }) }));
vi.mock('@renderer/features/settings/store/settings.store', () => ({ useSettingsStore: vi.fn() }));
vi.mock('@renderer/features/workspace/services/workspace.service', () => ({
  workspaceService: { isAvailable: () => true, saveNoteContent: mocks.save },
  normalizeNoteTag: vi.fn(), normalizeNoteTags: vi.fn(), resolveWorkspaceDeletionSelection: vi.fn(),
}));

function createStore() {
  setActivePinia(createPinia());
  const store = useWorkspaceStore();
  store.notes = [{ id: 'note', contentId: 'content', title: 'Note', content: '', parentId: null,
    order: 0, createdAt: 0, updatedAt: 0, tags: [] }];
  store.activeNoteId = 'note';
  return store;
}

describe('workspace autosave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.save.mockReset().mockImplementation(async (_id: string, _contentId: string, content: string) => ({ success: true, content }));
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('does not overwrite newer edits and flush waits for the latest write', async () => {
    const store = createStore();
    let finish: (result: { success: boolean; content: string }) => void = () => {};
    mocks.save.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    await store.updateActiveContent('first');
    await vi.advanceTimersByTimeAsync(600);
    await store.updateActiveContent('second');
    let flushed = false;
    const flushing = store.forceFlushAutoSave().then(() => { flushed = true; });
    await Promise.resolve();
    expect(flushed).toBe(false);
    finish({ success: true, content: 'first' });
    await flushing;
    expect(store.notes[0].content).toBe('second');
    expect(mocks.save).toHaveBeenLastCalledWith('note', 'content', 'second');
  });

  it('keeps failed content retryable and rejects a failed flush', async () => {
    const store = createStore();
    mocks.save.mockResolvedValueOnce({ success: false, content: 'draft' });
    await store.updateActiveContent('draft');
    await expect(store.forceFlushAutoSave()).rejects.toThrow();
    expect(store.saveError).toBeTruthy();
    await store.forceFlushAutoSave();
    expect(mocks.save).toHaveBeenCalledTimes(2);
    expect(store.saveError).toBeNull();
    expect(store.notes[0].content).toBe('draft');
  });

  it('automatically retries failed writes without further input', async () => {
    const store = createStore();
    mocks.save.mockRejectedValueOnce(new Error('disk unavailable'));
    await store.updateActiveContent('draft');
    await vi.advanceTimersByTimeAsync(600);
    expect(store.saveError).toBe('disk unavailable');
    await vi.advanceTimersByTimeAsync(5000);
    expect(mocks.save).toHaveBeenCalledTimes(2);
    expect(store.saveError).toBeNull();
  });

  it('does not hide one note failure when another note saves successfully', async () => {
    const store = createStore();
    store.notes.push({ ...store.notes[0], id: 'other', contentId: 'other-content' });
    mocks.save.mockRejectedValueOnce(new Error('first note failed'));
    await store.updateActiveContent('first');
    store.activeNoteId = 'other';
    await store.updateActiveContent('second');
    await expect(store.forceFlushAutoSave()).rejects.toThrow('first note failed');
    expect(store.saveError).toBe('first note failed');
    expect(store.savingStatus).toBe('error');
    await store.forceFlushAutoSave();
    expect(store.saveError).toBeNull();
  });
});
