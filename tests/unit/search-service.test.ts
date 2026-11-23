import { searchService } from '../../electron/main/services/search.service';

const mocks = vi.hoisted(() => ({ read: vi.fn(), nodes: vi.fn() }));
vi.mock('../../electron/main/services/vfs.service.js', () => ({ vfsService: {
  ensureInitialized: vi.fn(), getAllNodes: mocks.nodes, readContent: mocks.read,
} }));
vi.mock('../../electron/main/services/log/logger.service.js', () => ({ loggerService: {
  createLogger: () => ({ error: vi.fn(), warn: vi.fn() }),
} }));
vi.mock('../../electron/main/utils/i18n.js', () => ({ $t: (key: string) => key }));

describe('full text search', () => {
  it('bounds concurrent reads and retains node order despite different completion times', async () => {
    const nodes = Array.from({ length: 12 }, (_, index) => ({
      id: String(index), contentId: String(index), type: 'file', name: `Note ${index}`,
    }));
    mocks.nodes.mockReturnValue(nodes);
    let active = 0;
    let peak = 0;
    mocks.read.mockImplementation(async (id: string) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, Number(id) % 2 ? 1 : 5));
      active--;
      return 'matching text';
    });
    const results = await searchService.searchNotes('matching');
    expect(peak).toBe(4);
    expect(results.map((result) => result.id)).toEqual(nodes.map((node) => node.id));
  });

  it('reports unreadable notes instead of returning a misleading complete result', async () => {
    mocks.nodes.mockReturnValue([{ id: '1', contentId: '1', type: 'file', name: 'Note' }]);
    mocks.read.mockRejectedValue(new Error('permission denied'));
    await expect(searchService.searchNotes('text')).rejects.toThrow('search.error.incomplete');
  });
});
