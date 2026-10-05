import type { Draft } from './store';

export type SaveState = 'draftIdle' | 'draftSaving' | 'draftSaved' | 'draftStorageFailed';

// Serialize commits and coalesce pending snapshots, never allowing an old write to win.
export class DraftWriter {
  private pending: Draft | undefined;
  private running: Promise<void> | undefined;
  private failed: Draft | undefined;
  dirty = false;
  constructor(private readonly save: (draft: Draft) => Promise<void>, private readonly status: (state: SaveState) => void) {}

  submit(draft: Draft): void {
    this.pending = draft;
    this.failed = undefined;
    this.dirty = true;
    this.status('draftSaving');
    this.start();
  }

  retry(): void { if (this.failed) this.submit(this.failed); }
  async settled(): Promise<void> { while (this.running) await this.running; }

  private start(): void {
    if (this.running) return;
    this.running = this.drain().finally(() => {
      this.running = undefined;
      if (this.pending) this.start();
    });
  }

  private async drain(): Promise<void> {
    while (this.pending) {
      const snapshot = this.pending;
      this.pending = undefined;
      try { await this.save(snapshot); } catch {
        this.failed = this.pending ?? snapshot;
        this.pending = undefined;
        this.status('draftStorageFailed');
        return;
      }
    }
    this.dirty = false;
    this.status('draftSaved');
  }
}
