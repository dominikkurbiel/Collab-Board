import { DEMO_BOARD, applyBoardAction, readBoard } from "@collab-board/shared";
import { EventEmitter } from "node:events";
import type { FastifyBaseLogger } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WebSocket } from "ws";
import * as Y from "yjs";
import { RoomManager } from "./room-manager.js";
import { MemoryBoardStorage } from "./storage/memory-storage.js";

const silentLog = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
} as unknown as FastifyBaseLogger;

/** Just enough of a WebSocket for Room: events, send and a ready state. */
class FakeSocket extends EventEmitter {
  readonly OPEN = 1;
  readyState = 1;
  binaryType = "nodebuffer";
  send(_message: Uint8Array, callback?: (error?: Error) => void) {
    callback?.();
  }
  close() {
    this.readyState = 3;
    this.emit("close");
  }
}

const fakeSocket = () => new FakeSocket() as unknown as WebSocket;

const OPTIONS = { saveDelayMs: 1_000, maxSaveDelayMs: 5_000, unloadDelayMs: 10_000 };

/** A stored board with one note, as the browser would have saved it. */
function storedBoard(text: string): Uint8Array {
  const doc = new Y.Doc();
  applyBoardAction(doc, {
    type: "addElement",
    element: {
      id: "note",
      type: "note",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      text,
      color: "yellow",
    },
  });
  return Y.encodeStateAsUpdate(doc);
}

let storage: MemoryBoardStorage;
let manager: RoomManager;

beforeEach(() => {
  vi.useFakeTimers();
  storage = new MemoryBoardStorage();
  manager = new RoomManager(storage, silentLog, OPTIONS);
});

afterEach(async () => {
  await manager.closeAll();
  vi.useRealTimers();
});

describe("RoomManager", () => {
  it("loads a saved board from storage", async () => {
    storage.boards.set("b1", storedBoard("hello"));
    const room = await manager.getRoom("b1");
    expect(readBoard(room.doc).elements[0]?.text).toBe("hello");
  });

  it("seeds the demo board without saving it until someone edits", async () => {
    const room = await manager.getRoom("demo");
    expect(readBoard(room.doc).elements).toHaveLength(DEMO_BOARD.elements.length);

    await vi.advanceTimersByTimeAsync(5_000);
    expect(storage.saveCount).toBe(0);
  });

  it("gives everyone opening a board at the same time the same room", async () => {
    const load = vi.spyOn(storage, "load");
    const [a, b] = await Promise.all([manager.getRoom("b1"), manager.getRoom("b1")]);
    expect(a).toBe(b);
    expect(load).toHaveBeenCalledOnce();
  });

  it("saves edits after a short pause", async () => {
    const room = await manager.getRoom("b1");
    applyBoardAction(room.doc, { type: "addElement", element: DEMO_BOARD.elements[0]! });
    expect(storage.saveCount).toBe(0);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(storage.saveCount).toBe(1);

    const saved = new Y.Doc();
    Y.applyUpdate(saved, storage.boards.get("b1")!);
    expect(readBoard(saved).elements).toHaveLength(1);
  });

  it("saves and unloads a room some time after the last person leaves", async () => {
    const room = await manager.getRoom("b1");
    const socket = fakeSocket();
    room.addConnection(socket);
    applyBoardAction(room.doc, { type: "addElement", element: DEMO_BOARD.elements[0]! });

    socket.close();
    await vi.advanceTimersByTimeAsync(9_000);
    expect(manager.size).toBe(1); // still in memory, in case they come back

    await vi.advanceTimersByTimeAsync(1_000);
    expect(manager.size).toBe(0);
    expect(storage.boards.has("b1")).toBe(true);

    // Coming back later loads the saved board into a fresh room
    const reloaded = await manager.getRoom("b1");
    expect(reloaded).not.toBe(room);
    expect(readBoard(reloaded.doc).elements).toHaveLength(1);
  });

  it("keeps the room while someone is connected", async () => {
    const room = await manager.getRoom("b1");
    room.addConnection(fakeSocket());
    await vi.advanceTimersByTimeAsync(60_000);
    expect(manager.size).toBe(1);
  });

  it("saves unsaved edits on shutdown", async () => {
    const room = await manager.getRoom("b1");
    applyBoardAction(room.doc, { type: "addElement", element: DEMO_BOARD.elements[0]! });

    await manager.closeAll(); // before the debounce fired
    expect(storage.saveCount).toBe(1);
  });

  it("retries loading after a storage error", async () => {
    vi.spyOn(storage, "load").mockRejectedValueOnce(new Error("database down"));
    await expect(manager.getRoom("b1")).rejects.toThrow("database down");
    await expect(manager.getRoom("b1")).resolves.toBeDefined();
  });
});
