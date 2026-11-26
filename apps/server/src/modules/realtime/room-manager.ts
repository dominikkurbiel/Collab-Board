import { DEMO_BOARD, DEMO_BOARD_ID, loadBoard } from "@collab-board/shared";
import type { FastifyBaseLogger } from "fastify";
import * as Y from "yjs";
import { DebouncedSaver } from "./debounced-saver.js";
import { Room } from "./room.js";
import type { BoardStorage } from "./board-storage.js";

/** Tags changes that come FROM storage (loading, seeding the demo): no need to save them. */
const FROM_STORAGE = Symbol("from-storage");

export interface RoomManagerOptions {
  /** Save this long after the last change... */
  saveDelayMs: number;
  /** ...but at least this often while people keep editing without a pause. */
  maxSaveDelayMs: number;
  /** Keep an empty room in memory this long, in case someone comes back (e.g. a reload). */
  unloadDelayMs: number;
}

const DEFAULT_OPTIONS: RoomManagerOptions = {
  saveDelayMs: 2_000,
  maxSaveDelayMs: 10_000,
  unloadDelayMs: 30_000,
};

interface ManagedRoom {
  room: Room;
  saver: DebouncedSaver;
  unloadTimer: ReturnType<typeof setTimeout> | null;
  unloading: boolean;
}

/**
 * Owns the lifecycle of every room:
 *   first connection → load from storage (or seed the demo) → live editing with
 *   debounced saves → last person leaves → save → unload from memory.
 */
export class RoomManager {
  /** Promises, so two people opening the same board at once share ONE loading room. */
  private readonly rooms = new Map<string, Promise<ManagedRoom>>();
  private readonly options: RoomManagerOptions;

  constructor(
    private readonly storage: BoardStorage,
    private readonly log: FastifyBaseLogger,
    options: Partial<RoomManagerOptions> = {},
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  async getRoom(boardId: string): Promise<Room> {
    let entry = this.rooms.get(boardId);
    if (!entry) {
      entry = this.loadRoom(boardId);
      this.rooms.set(boardId, entry);
      // If loading fails (database down), forget it so the next attempt retries
      entry.catch(() => this.rooms.delete(boardId));
    }
    return (await entry).room;
  }

  /** Number of rooms currently in memory. */
  get size(): number {
    return this.rooms.size;
  }

  /** Saves every room. Called on server shutdown so no edits are lost. */
  async closeAll(): Promise<void> {
    const results = await Promise.allSettled(this.rooms.values());
    await Promise.all(
      results.map(async (result) => {
        if (result.status !== "fulfilled") return;
        const managed = result.value;
        if (managed.unloadTimer) clearTimeout(managed.unloadTimer);
        await managed.saver.flush();
        managed.saver.dispose();
        managed.room.destroy();
      }),
    );
    this.rooms.clear();
  }

  private async loadRoom(boardId: string): Promise<ManagedRoom> {
    const room = new Room(boardId, this.log);

    const saved = await this.storage.load(boardId);
    if (saved) {
      Y.applyUpdate(room.doc, saved, FROM_STORAGE);
    } else if (boardId === DEMO_BOARD_ID) {
      room.doc.transact(() => loadBoard(room.doc, DEMO_BOARD), FROM_STORAGE);
    }

    const saver = new DebouncedSaver({
      // Encode at save time, so we always store the latest state
      save: () => this.storage.save(boardId, Y.encodeStateAsUpdate(room.doc)),
      delayMs: this.options.saveDelayMs,
      maxDelayMs: this.options.maxSaveDelayMs,
      onError: (error) => this.log.error({ err: error, boardId }, "Saving board failed, retrying"),
    });

    room.doc.on("update", (_update: Uint8Array, origin: unknown) => {
      if (origin !== FROM_STORAGE) saver.schedule();
    });

    const managed: ManagedRoom = { room, saver, unloadTimer: null, unloading: false };
    room.onEmpty = () => this.scheduleUnload(boardId, managed);
    // Also covers a client that disconnected while the room was loading
    this.scheduleUnload(boardId, managed);

    this.log.info({ boardId, fromStorage: saved !== null }, "Room loaded");
    return managed;
  }

  private scheduleUnload(boardId: string, managed: ManagedRoom): void {
    if (managed.unloadTimer) clearTimeout(managed.unloadTimer);
    managed.unloadTimer = setTimeout(
      () => void this.unload(boardId, managed),
      this.options.unloadDelayMs,
    );
  }

  private async unload(boardId: string, managed: ManagedRoom): Promise<void> {
    if (managed.unloading || managed.room.connectionCount > 0) return;
    managed.unloading = true;
    try {
      await managed.saver.flush();
      // Someone joined while we were saving, or the save failed: keep the room
      if (managed.room.connectionCount > 0) return;
      if (managed.saver.hasUnsavedChanges) {
        this.scheduleUnload(boardId, managed);
        return;
      }
      this.rooms.delete(boardId);
      managed.saver.dispose();
      managed.room.destroy();
      this.log.info({ boardId }, "Room unloaded");
    } finally {
      managed.unloading = false;
    }
  }
}
