/** Limits how often something can be tried per key, e.g. password guesses per IP and board. */
export class AttemptLimiter {
  constructor(
    private readonly maxAttempts: number,
    private readonly windowMs: number,
  ) {}

  /** Records a failed attempt. */
  fail(_key: string): void {
    throw new Error("Not implemented");
  }

  /** Milliseconds until the key may try again, or 0 if it may try now. */
  retryAfter(_key: string): number {
    throw new Error("Not implemented");
  }

  reset(_key: string): void {
    throw new Error("Not implemented");
  }
}
