import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useWorkspaceStore } from '@renderer/features/workspace/store/workspace.store';

describe('workspace store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
  });

  it('keeps an empty workspace empty after initialization', async () => {
    vi.stubGlobal('window', {
      electronAPI: {
        vfs: {
          initWorkspace: vi.fn().mockResolvedValue({ nodes: [] }),
          readContent: vi.fn(),
          createFile: vi.fn(),
          writeContent: vi.fn(),
        },
      },
    });

    const store = useWorkspaceStore();

    await store.initializeWorkspace();

    expect(store.initialized).toBe(true);
    expect(store.notes).toEqual([]);
    expect(store.activeNoteId).toBeNull();
  });

  it('waits for workspace initialization before creating a note', async () => {
    const initWorkspace = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ nodes: [] }), 10);
        }),
    );
    const createFile = vi.fn().mockResolvedValue({
      id: 'note-1',
      contentId: 'content-1',
      name: '新建笔记',
      createdAt: 100,
      updatedAt: 100,
    });

    vi.stubGlobal('window', {
      electronAPI: {
        vfs: {
          initWorkspace,
          readContent: vi.fn(),
          createFile,
          writeContent: vi.fn(),
        },
      },
    });

    const store = useWorkspaceStore();

    await store.createNote();

    expect(initWorkspace).toHaveBeenCalledTimes(1);
    expect(createFile).toHaveBeenCalledWith({
      parentId: null,
      name: '新建笔记',
      content: '# 新建笔记\n\n',
    });
    expect(store.notes).toHaveLength(1);
    expect(store.notes[0]?.id).toBe('note-1');
    expect(store.activeNoteId).toBe('note-1');
  });
});
