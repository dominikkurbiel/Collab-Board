/** Above this many tracked keys, expired ones are cleaned up so memory can't grow forever. */
const CLEANUP_THRESHOLD = 10_000;

interface Window {
  startedAt: number;
  failures: number;
}

/**
 * Limits failed attempts per key (e.g. password guesses per IP and board) with a fixed
 * time window: after `maxAttempts` failures the key must wait until the window ends.
 * In memory, so per server instance; with several instances this would move to Redis.
 */
export class AttemptLimiter {
  private readonly windows = new Map<string, Window>();

  constructor(
    private readonly maxAttempts: number,
    private readonly windowMs: number,
  ) {}

  /** Records a failed attempt. */
  fail(key: string): void {
    const now = Date.now();
    const current = this.windows.get(key);
    if (current && !this.isExpired(current, now)) {
      current.failures++;
    } else {
      if (this.windows.size >= CLEANUP_THRESHOLD) this.removeExpired(now);
      this.windows.set(key, { startedAt: now, failures: 1 });
    }
  }

  /** Milliseconds until the key may try again, or 0 if it may try now. */
  retryAfter(key: string): number {
    const now = Date.now();
    const current = this.windows.get(key);
    if (!current || this.isExpired(current, now) || current.failures < this.maxAttempts) return 0;
    return current.startedAt + this.windowMs - now;
  }

  reset(key: string): void {
    this.windows.delete(key);
  }

  private isExpired(window: Window, now: number): boolean {
    return now - window.startedAt >= this.windowMs;
  }

  private removeExpired(now: number): void {
    for (const [key, window] of this.windows) {
      if (this.isExpired(window, now)) this.windows.delete(key);
    }
  }
}
