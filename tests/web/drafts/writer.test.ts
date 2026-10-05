import { expect, it, vi } from 'vitest';
import { DraftWriter } from '../../../apps/web/src/drafts/writer';
import type { Draft } from '../../../apps/web/src/drafts/store';

function draft(markdown: string): Draft {
  return { id: crypto.randomUUID(), markdown, mode: 'source', schemaVersion: 1, scope: 'preview', updatedAt: new Date().toISOString() };
}

it('serializes commits and coalesces intermediate snapshots', async () => {
  let finish: (() => void) | undefined;
  const saved: string[] = [];
  const save = vi.fn(async (value: Draft) => {
    if (value.markdown === 'first') await new Promise<void>((resolve) => { finish = resolve; });
    saved.push(value.markdown);
  });
  const status = vi.fn(); const writer = new DraftWriter(save, status);
  writer.submit(draft('first')); writer.submit(draft('second')); writer.submit(draft('third'));
  expect(writer.dirty).toBe(true); expect(status).not.toHaveBeenCalledWith('draftSaved');
  finish?.(); await writer.settled();
  expect(saved).toEqual(['first', 'third']); expect(writer.dirty).toBe(false);
  expect(status).toHaveBeenLastCalledWith('draftSaved');
});

it('retains the latest snapshot on quota failure and retries it', async () => {
  const save = vi.fn<(draft: Draft) => Promise<void>>().mockRejectedValueOnce(new DOMException('', 'QuotaExceededError')).mockResolvedValue(undefined);
  const status = vi.fn(); const writer = new DraftWriter(save, status);
  const latest = draft('latest source'); writer.submit(latest); await writer.settled();
  expect(writer.dirty).toBe(true); expect(status).toHaveBeenLastCalledWith('draftStorageFailed');
  writer.retry(); await writer.settled();
  expect(save).toHaveBeenLastCalledWith(latest); expect(writer.dirty).toBe(false);
});
