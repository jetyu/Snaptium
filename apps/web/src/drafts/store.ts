import { z } from 'zod';

export const MAX_DRAFT_BYTES = 1024 * 1024;
const schema = z.object({
  schemaVersion: z.literal(1), scope: z.literal('preview'),
  id: z.uuid(), markdown: z.string().refine((value) => value.length <= MAX_DRAFT_BYTES && new TextEncoder().encode(value).length <= MAX_DRAFT_BYTES),
  mode: z.enum(['rich', 'source']), updatedAt: z.iso.datetime(),
}).strict();
export type Draft = z.infer<typeof schema>;
export type DraftMode = Draft['mode'];
export class DraftStorageError extends Error {
  constructor() { super('draftStorageFailed'); }
}

// Preview-only storage: never share this namespace with authenticated note drafts.
export class DraftStore {
  private database: IDBDatabase | undefined;
  constructor(private readonly factory: IDBFactory | undefined) {}

  async open(): Promise<void> {
    const factory = this.factory;
    if (!factory) throw new DraftStorageError();
    if (this.database) return;
    await new Promise<void>((resolve, reject) => {
      const request = factory.open('snaptium-preview-drafts', 1);
      let refused = false;
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore('drafts', { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
      };
      request.onblocked = request.onerror = () => { refused = true; reject(new DraftStorageError()); };
      request.onsuccess = () => {
        if (refused) { request.result.close(); return; }
        this.database = request.result;
        this.database.onversionchange = () => this.close();
        resolve();
      };
    });
  }

  async list(): Promise<Draft[]> {
    const database = this.database;
    if (!database) throw new DraftStorageError();
    return new Promise((resolve, reject) => {
      const drafts: Draft[] = [];
      const transaction = database.transaction('drafts', 'readonly');
      const request = transaction.objectStore('drafts').index('updatedAt').openCursor(null, 'prev');
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        const raw: unknown = cursor.value;
        const parsed = schema.safeParse(raw);
        // Refuse incompatible records without deleting or overwriting them.
        if (!parsed.success) { transaction.abort(); return; }
        drafts.push(parsed.data);
        if (drafts.length < 20) cursor.continue();
      };
      transaction.oncomplete = () => resolve(drafts);
      transaction.onabort = transaction.onerror = () => reject(new DraftStorageError());
    });
  }

  async save(draft: Draft): Promise<void> {
    const parsed = schema.safeParse(draft);
    if (!parsed.success) throw new DraftStorageError();
    if (!this.database) await this.open();
    const database = this.database;
    if (!database) throw new DraftStorageError();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('drafts', 'readwrite', { durability: 'strict' });
      transaction.objectStore('drafts').put(parsed.data);
      transaction.oncomplete = () => resolve();
      transaction.onabort = transaction.onerror = () => reject(new DraftStorageError());
    });
  }

  close(): void { this.database?.close(); this.database = undefined; }
}
