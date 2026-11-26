import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AttemptLimiter } from "./attempt-limiter.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("AttemptLimiter", () => {
  it("allows attempts until the limit is reached", () => {
    const limiter = new AttemptLimiter(2, 60_000);
    expect(limiter.retryAfter("ip")).toBe(0);

    limiter.fail("ip");
    expect(limiter.retryAfter("ip")).toBe(0);

    limiter.fail("ip");
    expect(limiter.retryAfter("ip")).toBe(60_000);
  });

  it("allows trying again once the window has passed", () => {
    const limiter = new AttemptLimiter(1, 60_000);
    limiter.fail("ip");

    vi.advanceTimersByTime(45_000);
    expect(limiter.retryAfter("ip")).toBe(15_000);

    vi.advanceTimersByTime(15_000);
    expect(limiter.retryAfter("ip")).toBe(0);
  });

  it("tracks keys separately", () => {
    const limiter = new AttemptLimiter(1, 60_000);
    limiter.fail("attacker");
    expect(limiter.retryAfter("someone-else")).toBe(0);
  });

  it("forgets a key after a successful attempt", () => {
    const limiter = new AttemptLimiter(2, 60_000);
    limiter.fail("ip");
    limiter.reset("ip");
    limiter.fail("ip");
    expect(limiter.retryAfter("ip")).toBe(0);
  });
});
