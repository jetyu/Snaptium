import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { syncService } from '../../electron/main/services/sync/sync.service';
import { historyService } from '../../electron/main/services/history.service';
import { createManifestEntry, createManifestFromEntries, readLocalFile, writeLocalFile } from '../../electron/main/services/sync/manifest.service';

const mocks = vi.hoisted(() => ({
  root: '', remote: new Map<string, string>(), loadState: vi.fn(),
  provider: { testConnection: vi.fn(), readText: vi.fn(), writeText: vi.fn(), deleteFile: vi.fn(), listFiles: vi.fn() },
}));
vi.mock('electron', () => ({ BrowserWindow: {}, dialog: {} }));
vi.mock('../../electron/main/utils/i18n.js', () => ({ $t: (key: string) => key }));
vi.mock('../../electron/main/services/log/logger.service.js', () => ({ loggerService: {
  createLogger: () => ({ debug: vi.fn(), error: vi.fn(), warn: vi.fn() }),
} }));
vi.mock('../../electron/main/services/vfs.service.js', () => ({ vfsService: {
  ensureInitialized: async () => mocks.root, reloadWorkspaceState: vi.fn(),
} }));
vi.mock('../../electron/main/services/settings.service.js', () => ({ settingsService: {
  loadConfig: async () => ({ noteStorage: { maxHistoryVersions: 0 }, sync: {} }), saveConfig: vi.fn(),
} }));
vi.mock('../../electron/main/services/key-manager.service.js', () => ({ keyManagerService: {
  hasKeySlots: async () => true, isUnlocked: () => true, getDEK: () => 'key', loadKeySlots: async () => null,
} }));
vi.mock('../../electron/main/services/crypto.service.js', () => ({ cryptoService: {
  encryptContent: (text: string) => text, decryptContent: (text: string) => text,
} }));
vi.mock('../../electron/main/services/sync/state.service.js', () => ({ syncStateService: {
  loadWorkspaceState: mocks.loadState, beginSession: async () => ({ id: 'session' }), finishSession: vi.fn(),
} }));
vi.mock('../../electron/main/services/sync/providers/webdav.provider.js', () => ({ createWebDavProvider: () => mocks.provider }));
vi.mock('../../electron/main/services/sync/providers/s3.provider.js', () => ({ createS3Provider: () => mocks.provider }));

const contentId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const notePath = `objects/${contentId}.md`;
const config = { enabled: true, webdav: { url: 'https://example.test', username: 'user', password: 'password' } };

describe('sync conflict preservation', () => {
  beforeEach(async () => {
    mocks.root = await mkdtemp(path.join(os.tmpdir(), 'snaptium-sync-'));
    mocks.remote.clear();
    mocks.provider.readText.mockImplementation(async (file: string) => mocks.remote.get(file) ?? null);
    mocks.provider.writeText.mockImplementation(async (file: string, text: string) => { mocks.remote.set(file, text); });
    mocks.provider.deleteFile.mockImplementation(async (file: string) => { mocks.remote.delete(file); });
    mocks.loadState.mockResolvedValue({ state: {
      baselineManifest: createManifestFromEntries([createManifestEntry(notePath, 'base')]),
    }, recoveredPendingSession: false });
    await writeLocalFile(mocks.root, notePath, 'local edit');
    mocks.remote.set(`Database/${notePath}`, 'remote edit');
    mocks.remote.set('.snaptium-sync/manifest.json', JSON.stringify(createManifestFromEntries([
      createManifestEntry(notePath, 'remote edit', Date.now() + 10000),
    ])));
  });
  afterEach(async () => { await rm(mocks.root, { recursive: true, force: true }); });

  it('preserves both versions before remote overwrite even when ordinary history is disabled', async () => {
    const result = await syncService.runSync(config);
    expect(result.summary.conflicts).toBe(1);
    expect(await readLocalFile(mocks.root, notePath)).toBe('remote edit');
    const versions = await historyService.getVersions(mocks.root, contentId);
    const contents = await Promise.all(versions.map((version) => historyService.getVersionContent(mocks.root, contentId, version.filename)));
    expect(contents).toEqual(['remote edit', 'local edit']);
  });

  it('does not overwrite the local version if the remote conflict cannot be preserved', async () => {
    mocks.remote.delete(`Database/${notePath}`);
    await expect(syncService.runSync(config)).rejects.toThrow('sync.error.remoteConflictUnavailable');
    expect(await readLocalFile(mocks.root, notePath)).toBe('local edit');
  });
});
