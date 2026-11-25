"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WebsocketProvider } from "y-websocket";
import { createRandomUser, parseUser, readRemoteUsers, type RemoteUser } from "./presence";
import type { Point } from "./viewport";

export type Awareness = WebsocketProvider["awareness"];

/** Max ~20 cursor updates per second: smooth enough, and far fewer messages than 60/s. */
const CURSOR_THROTTLE_MS = 50;
const USER_STORAGE_KEY = "collab-board:user";

/**
 * Identity for this browser tab. sessionStorage (not localStorage) so two windows
 * side by side are two different people, which is exactly what you test with.
 */
function getSessionUser() {
  try {
    const saved = parseUser(JSON.parse(sessionStorage.getItem(USER_STORAGE_KEY) ?? "null"));
    if (saved) return saved;
  } catch {
    // Corrupted value or storage disabled: just make a new identity
  }
  const user = createRandomUser();
  try {
    sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } catch {
    // Storage disabled (e.g. strict privacy mode): the identity lasts until reload
  }
  return user;
}

/** Everyone else on the board, re-rendering only the component that uses it. */
export function useRemoteUsers(awareness: Awareness | null): RemoteUser[] {
  const [users, setUsers] = useState<RemoteUser[]>([]);

  useEffect(() => {
    if (!awareness) return;
    // "change" fires only when someone's state really changed (not on keep-alive pings)
    const update = () => setUsers(readRemoteUsers(awareness.getStates(), awareness.clientID));
    update();
    awareness.on("change", update);
    return () => {
      awareness.off("change", update);
      setUsers([]);
    };
  }, [awareness]);

  return users;
}

/**
 * Introduces us to the room and returns a throttled function that shares our cursor
 * position (in world coordinates, or null when the cursor leaves the board).
 */
export function useLocalPresence(awareness: Awareness | null) {
  const pending = useRef<Point | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!awareness) return;
    awareness.setLocalStateField("user", getSessionUser());
    return () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
  }, [awareness]);

  return useCallback(
    (cursor: Point | null) => {
      if (!awareness) return;
      pending.current = cursor;

      // Leaving the board is sent right away, so the cursor doesn't linger for others
      if (cursor === null) {
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
        awareness.setLocalStateField("cursor", null);
        return;
      }
      // Otherwise send at most once per CURSOR_THROTTLE_MS, always the latest position
      if (timer.current) return;
      timer.current = setTimeout(() => {
        timer.current = null;
        awareness.setLocalStateField("cursor", pending.current);
      }, CURSOR_THROTTLE_MS);
    },
    [awareness],
  );
}
