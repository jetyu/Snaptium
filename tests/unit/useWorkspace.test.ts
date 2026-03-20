import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useWorkspace } from '../../src/renderer/features/workspace/composables/useWorkspace';
import { useWorkspaceStore } from '../../src/renderer/features/workspace/store/workspace.store';

describe('useWorkspace', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('keeps store action context when creating a note through the composable', async () => {
    const createFile = vi.fn().mockResolvedValue({
      id: 'note-1',
      contentId: 'content-1',
      name: '新建笔记',
      createdAt: 1,
      updatedAt: 1,
    });

    vi.stubGlobal('window', {
      electronAPI: {
        vfs: {
          createFile,
        },
      },
    });

    const workspace = useWorkspace();
    const store = useWorkspaceStore();

    await expect(workspace.createNote()).resolves.toBeUndefined();

    expect(createFile).toHaveBeenCalledOnce();
    expect(store.notes).toHaveLength(2);
    expect(store.activeNoteId).toBe('note-1');
    expect(store.notes[0]).toMatchObject({
      id: 'note-1',
      contentId: 'content-1',
      title: '新建笔记',
      content: '# 新建笔记\n\n',
    });
  });
});
