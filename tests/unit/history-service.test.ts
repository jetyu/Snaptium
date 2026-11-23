import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { historyService } from '../../electron/main/services/history.service';
import { filenameToTimestamp } from '../../electron/main/utils/formatTools';

vi.mock('../../electron/main/services/log/logger.service.js', () => ({ loggerService: {
  createLogger: () => ({ debug: vi.fn(), error: vi.fn(), warn: vi.fn() }),
} }));

describe('history version preservation', () => {
  it('preserves both versions even when saved at the same clock time', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'snaptium-history-'));
    vi.spyOn(Date, 'now').mockReturnValue(1800000000000);
    try {
      await historyService.saveVersion(root, 'note', 'local edit', 2);
      await historyService.saveVersion(root, 'note', 'remote edit', 2);
      const versions = await historyService.getVersions(root, 'note');
      expect(versions).toHaveLength(2);
      const contents = await Promise.all(versions.map((version) => historyService.getVersionContent(root, 'note', version.filename)));
      expect(contents).toEqual(['remote edit', 'local edit']);
    } finally {
      vi.restoreAllMocks();
      await rm(root, { recursive: true, force: true });
    }
  });

  it('continues to parse older second-precision filenames', () => {
    expect(filenameToTimestamp('2026-11-08_123456.md')).toBe(new Date(2026, 10, 8, 12, 34, 56).getTime());
    expect(filenameToTimestamp('2026-11-08_123456789.md')).toBe(new Date(2026, 10, 8, 12, 34, 56, 789).getTime());
  });
});
