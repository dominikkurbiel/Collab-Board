import type { Point } from "./viewport";

/**
 * Presence = who else is on the board and where their cursor is.
 * It travels through Yjs "awareness": short-lived state that is broadcast to everyone
 * in the room but never saved in the document.
 */

export interface PresenceUser {
  name: string;
  color: string;
}

export interface RemoteUser {
  clientId: number;
  user: PresenceUser;
  /** WORLD coordinates, so it points at the same spot on the board for everyone. */
  cursor: Point | null;
}

export const PRESENCE_COLORS = [
  "#e11d48",
  "#ea580c",
  "#ca8a04",
  "#16a34a",
  "#0891b2",
  "#2563eb",
  "#7c3aed",
  "#c026d3",
] as const;

const ADJECTIVES = ["Swift", "Clever", "Brave", "Calm", "Witty", "Bright", "Bold", "Kind"];
const ANIMALS = ["Otter", "Fox", "Panda", "Koala", "Falcon", "Lynx", "Owl", "Dolphin"];

function pick<T>(items: readonly T[], random: () => number): T {
  const item = items[Math.floor(random() * items.length)];
  if (item === undefined) throw new Error("Cannot pick from an empty list");
  return item;
}

/** A random, friendly identity until real accounts exist, e.g. "Swift Otter". */
export function createRandomUser(random: () => number = Math.random): PresenceUser {
  return {
    name: `${pick(ADJECTIVES, random)} ${pick(ANIMALS, random)}`,
    color: pick(PRESENCE_COLORS, random),
  };
}

/**
 * Turns everyone's awareness state into a list of other users, skipping ourselves and
 * anything malformed (the data comes from other clients, so it isn't trusted).
 */
export function readRemoteUsers(
  states: ReadonlyMap<number, Record<string, unknown>>,
  ownClientId: number,
): RemoteUser[] {
  const users: RemoteUser[] = [];
  for (const [clientId, state] of states) {
    if (clientId === ownClientId) continue;
    const user = parseUser(state.user);
    if (!user) continue; // connected, but hasn't introduced itself yet
    users.push({ clientId, user, cursor: parsePoint(state.cursor) });
  }
  return users.sort((a, b) => a.clientId - b.clientId);
}

export function parseUser(value: unknown): PresenceUser | null {
  if (typeof value !== "object" || value === null) return null;
  const { name, color } = value as Record<string, unknown>;
  if (typeof name !== "string" || typeof color !== "string") return null;
  // Only our own palette: a color string from another client ends up in CSS
  if (!(PRESENCE_COLORS as readonly string[]).includes(color)) return null;
  return { name: name.slice(0, 40), color };
}

function parsePoint(value: unknown): Point | null {
  if (typeof value !== "object" || value === null) return null;
  const { x, y } = value as Record<string, unknown>;
  return Number.isFinite(x) && Number.isFinite(y) ? { x: x as number, y: y as number } : null;
}
