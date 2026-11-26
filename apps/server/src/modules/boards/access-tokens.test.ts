import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccessTokens } from "./access-tokens.js";

const SECRET = "test-secret-at-least-32-characters-long";
const TTL_MS = 60_000;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("AccessTokens", () => {
  it("accepts a token it issued for the same board", () => {
    const tokens = new AccessTokens(SECRET, TTL_MS);
    expect(tokens.verify(tokens.issue("board-1"), "board-1")).toBe(true);
  });

  it("rejects the token for a different board", () => {
    const tokens = new AccessTokens(SECRET, TTL_MS);
    expect(tokens.verify(tokens.issue("board-1"), "board-2")).toBe(false);
  });

  it("rejects a token signed with another secret", () => {
    const token = new AccessTokens("another-secret-of-32-characters-or-more", TTL_MS).issue("b");
    expect(new AccessTokens(SECRET, TTL_MS).verify(token, "b")).toBe(false);
  });

  it("rejects a token whose expiry was changed", () => {
    const tokens = new AccessTokens(SECRET, TTL_MS);
    const [boardId, , signature] = tokens.issue("b").split(".");
    const extended = `${boardId}.${Date.now() + 10 * TTL_MS}.${signature}`;

    expect(tokens.verify(extended, "b")).toBe(false);
  });

  it("rejects an expired token", () => {
    const tokens = new AccessTokens(SECRET, TTL_MS);
    const token = tokens.issue("b");

    vi.advanceTimersByTime(TTL_MS + 1);
    expect(tokens.verify(token, "b")).toBe(false);
  });

  it("rejects garbage without throwing", () => {
    const tokens = new AccessTokens(SECRET, TTL_MS);
    for (const garbage of ["", "a", "a.b", "a.b.c.d", "b.notanumber.sig"]) {
      expect(tokens.verify(garbage, "b")).toBe(false);
    }
  });

  it("refuses a weak secret", () => {
    expect(() => new AccessTokens("short", TTL_MS)).toThrow();
  });
});
