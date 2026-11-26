interface DebouncedSaverOptions {
  save: () => Promise<void>;
  /** Wait this long after the last change before saving (debounce)... */
  delayMs: number;
  /** ...but never longer than this after the first unsaved change. */
  maxDelayMs: number;
  onError: (error: unknown) => void;
}

/**
 * Batches many quick changes into one save. Dragging a note produces dozens of changes
 * per second; writing each one to the database would be wasteful, so we save once the
 * edits pause (or every `maxDelayMs` during non-stop editing).
 *
 * Saves never overlap: each one waits for the previous, so an older state can't
 * overwrite a newer one.
 */
export class DebouncedSaver {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private firstChangeAt: number | null = null;
  private dirty = false;
  private disposed = false;
  private saving: Promise<void> = Promise.resolve();

  constructor(private readonly options: DebouncedSaverOptions) {}

  get hasUnsavedChanges(): boolean {
    return this.dirty;
  }

  /** Call on every change. */
  schedule(): void {
    if (this.disposed) return;
    this.dirty = true;

    const now = Date.now();
    this.firstChangeAt ??= now;
    const untilDeadline = this.firstChangeAt + this.options.maxDelayMs - now;
    const wait = Math.max(0, Math.min(this.options.delayMs, untilDeadline));

    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), wait);
  }

  /** Saves right away if there are unsaved changes, and waits for it to finish. */
  flush(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;

    if (this.dirty) {
      this.dirty = false;
      this.firstChangeAt = null;
      this.saving = this.saving.then(this.options.save).catch((error: unknown) => {
        this.options.onError(error);
        this.schedule(); // still unsaved: try again later
      });
    }
    return this.saving;
  }

  dispose(): void {
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
