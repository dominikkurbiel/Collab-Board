import { describe, expect, it } from "vitest";
import { PRESENCE_COLORS, createRandomUser, readRemoteUsers } from "./presence";

const alice = { name: "Swift Otter", color: PRESENCE_COLORS[0] };
const bob = { name: "Calm Fox", color: PRESENCE_COLORS[1] };

describe("createRandomUser", () => {
  it("builds a name and a color from the palette", () => {
    const user = createRandomUser(() => 0);
    expect(user).toEqual({ name: "Swift Otter", color: PRESENCE_COLORS[0] });
  });
});

describe("readRemoteUsers", () => {
  it("lists other users with their cursors, without ourselves", () => {
    const states = new Map<number, Record<string, unknown>>([
      [1, { user: alice, cursor: { x: 10, y: -20 } }],
      [2, { user: bob, cursor: null }],
      [3, { user: { name: "Me", color: PRESENCE_COLORS[2] } }],
    ]);

    expect(readRemoteUsers(states, 3)).toEqual([
      { clientId: 1, user: alice, cursor: { x: 10, y: -20 } },
      { clientId: 2, user: bob, cursor: null },
    ]);
  });

  it("skips users that haven't introduced themselves yet", () => {
    const states = new Map<number, Record<string, unknown>>([[1, {}]]);
    expect(readRemoteUsers(states, 99)).toEqual([]);
  });

  it("rejects colors outside the palette (they end up in CSS)", () => {
    const states = new Map<number, Record<string, unknown>>([
      [1, { user: { name: "Hacker", color: "red; background: url(x)" } }],
    ]);
    expect(readRemoteUsers(states, 99)).toEqual([]);
  });

  it("ignores invalid cursor positions", () => {
    const states = new Map<number, Record<string, unknown>>([
      [1, { user: alice, cursor: { x: "10", y: Number.NaN } }],
    ]);
    expect(readRemoteUsers(states, 99)[0]?.cursor).toBeNull();
  });

  it("truncates very long names", () => {
    const states = new Map<number, Record<string, unknown>>([
      [1, { user: { ...alice, name: "x".repeat(500) } }],
    ]);
    expect(readRemoteUsers(states, 99)[0]?.user.name).toHaveLength(40);
  });
});
