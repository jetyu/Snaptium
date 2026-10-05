import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DraftStore, MAX_DRAFT_BYTES } from '../../../apps/web/src/drafts/store';
import type { Draft } from '../../../apps/web/src/drafts/store';

const opened: DraftStore[] = [];
function connect(factory = new IDBFactory()): DraftStore {
  const store = new DraftStore(factory); opened.push(store); return store;
}
function draft(markdown = '# 草稿\n', id = crypto.randomUUID()): Draft {
  return { id, markdown, mode: 'source', updatedAt: '2026-10-05T00:00:00.000Z', schemaVersion: 1, scope: 'preview' };
}
afterEach(() => { for (const store of opened) store.close(); opened.length = 0; vi.restoreAllMocks(); });

describe('preview draft storage', () => {
  it('reports an aborted transaction as failure and preserves the previous commit', async () => {
    const store = connect(); await store.open(); const original = draft(); await store.save(original);
    const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(function (this: IDBObjectStore, value: unknown) {
      const request = put.call(this, value);
      this.transaction.abort();
      return request;
    });
    await expect(store.save({ ...original, markdown: 'not committed' })).rejects.toThrow('draftStorageFailed');
    expect(await store.list()).toEqual([original]);
  });
  it('recovers exact raw source after closing and reopening', async () => {
    const factory = new IDBFactory();
    const first = connect(factory); await first.open();
    const original = draft('<script>unsupported source</script>\r\n');
    await first.save(original); first.close();
    const second = connect(factory); await second.open();
    expect(await second.list()).toEqual([original]);
  });
  it('preserves the original when another session restores a copy', async () => {
    const factory = new IDBFactory();
    const first = connect(factory); const second = connect(factory);
    await first.open(); await second.open();
    const original = draft(); const copy = draft('modified copy');
    await first.save(original); await second.save(copy);
    expect(await first.list()).toEqual(expect.arrayContaining([original, copy]));
  });
  it('rejects oversized writes without changing the last committed value', async () => {
    const store = connect(); await store.open(); const original = draft();
    await store.save(original);
    await expect(store.save({ ...original, markdown: 'x'.repeat(MAX_DRAFT_BYTES + 1) })).rejects.toThrow('draftStorageFailed');
    expect(await store.list()).toEqual([original]);
  });
  it('returns only the most recent 20 records, retaining older ones', async () => {
    const store = connect(); await store.open();
    for (let index = 0; index < 21; index++) {
      await store.save({ ...draft(String(index)), updatedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString() });
    }
    const result = await store.list();
    expect(result).toHaveLength(20); expect(result[0]?.markdown).toBe('20');
  });
  it('fails explicitly when IndexedDB is unavailable', async () => {
    await expect(new DraftStore(undefined).open()).rejects.toThrow('draftStorageFailed');
  });
  it('refuses a future database version without deleting its data', async () => {
    const factory = new IDBFactory();
    await new Promise<void>((resolve, reject) => {
      const request = factory.open('snaptium-preview-drafts', 2);
      request.onupgradeneeded = () => request.result.createObjectStore('future');
      request.onerror = () => reject(new Error('test setup failed'));
      request.onsuccess = () => { request.result.close(); resolve(); };
    });
    await expect(connect(factory).open()).rejects.toThrow('draftStorageFailed');
    expect((await factory.databases())[0]?.version).toBe(2);
  });
  it('refuses malformed stored rows without resetting the database', async () => {
    const factory = new IDBFactory(); const store = connect(factory); await store.open();
    await new Promise<void>((resolve) => {
      const request = factory.open('snaptium-preview-drafts', 1);
      request.onsuccess = () => {
        const transaction = request.result.transaction('drafts', 'readwrite');
        transaction.objectStore('drafts').put({ id: 'broken', updatedAt: '2026-10-06T00:00:00.000Z' });
        transaction.oncomplete = () => { request.result.close(); resolve(); };
      };
    });
    await expect(store.list()).rejects.toThrow('draftStorageFailed');
    await expect(store.list()).rejects.toThrow('draftStorageFailed');
  });
});
