"use client";

import {
  EMPTY_BOARD,
  applyBoardAction,
  readBoard,
  type BoardAction,
  type BoardDocument,
} from "@collab-board/shared";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";
import type { Awareness } from "./use-presence";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4000/ws";

/**
 * - connecting: first connection, the board isn't loaded yet
 * - online:     connected and in sync with the server
 * - offline:    connection lost; edits still work locally and are sent on reconnect
 */
export type ConnectionStatus = "connecting" | "online" | "offline";

/**
 * Wraps a Y.Doc as an external store for React: a cached snapshot that is replaced
 * after every change, so useSyncExternalStore can re-render only when needed.
 */
function createBoardStore(doc: Y.Doc) {
  let snapshot = readBoard(doc);
  const listeners = new Set<() => void>();

  doc.on("update", () => {
    snapshot = readBoard(doc, snapshot);
    for (const listener of listeners) listener();
  });

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const getServerSnapshot = () => EMPTY_BOARD;

/**
 * The live, shared board document. Same shape as the old useReducer: the current
 * `board` plus `dispatch(action)`, but every change is synced to everyone in the room.
 */
export function useBoardDocument(boardId: string) {
  // A fresh document per board. Creating it has no side effects, so useMemo is fine;
  // the network connection is opened in an effect below.
  const doc = useMemo(() => new Y.Doc(), [boardId]);
  const store = useMemo(() => createBoardStore(doc), [doc]);
  const board: BoardDocument = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    getServerSnapshot,
  );

  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  // Presence channel (cursors, who is online); exists while this board is open
  const [awareness, setAwareness] = useState<Awareness | null>(null);

  useEffect(() => {
    // Connects to `${WS_URL}/${boardId}` and keeps reconnecting if the connection drops
    const provider = new WebsocketProvider(WS_URL, boardId, doc);
    setAwareness(provider.awareness);
    let hasSynced = false;

    provider.on("sync", (isSynced: boolean) => {
      if (isSynced) {
        hasSynced = true;
        setStatus("online");
      }
    });
    provider.on("status", ({ status }: { status: string }) => {
      if (status !== "connected") setStatus(hasSynced ? "offline" : "connecting");
    });

    return () => {
      provider.destroy(); // also tells others we left, so our cursor disappears
      setAwareness(null);
      setStatus("connecting");
    };
  }, [boardId, doc]);

  const dispatch = useCallback((action: BoardAction) => applyBoardAction(doc, action), [doc]);

  return { board, dispatch, status, awareness };
}
