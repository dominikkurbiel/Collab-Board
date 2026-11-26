import type { BoardStorage } from "./board-storage.js";

/** Keeps boards in a Map. For tests (and running without a database). */
export class MemoryBoardStorage implements BoardStorage {
  readonly boards = new Map<string, Uint8Array>();
  saveCount = 0;

  async load(boardId: string): Promise<Uint8Array | null> {
    return this.boards.get(boardId) ?? null;
  }

  async save(boardId: string, state: Uint8Array): Promise<void> {
    this.saveCount++;
    this.boards.set(boardId, state);
  }
}
