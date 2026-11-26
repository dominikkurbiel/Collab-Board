import type { BoardRecord, BoardRepository } from "./board.repository.js";

/** In-memory BoardRepository for tests. */
export class MemoryBoardRepository implements BoardRepository {
  readonly boards = new Map<string, BoardRecord & { state: Uint8Array }>();

  async create(board: BoardRecord & { state: Uint8Array }): Promise<void> {
    if (this.boards.has(board.id)) throw new Error(`Board "${board.id}" already exists`);
    this.boards.set(board.id, board);
  }

  async findById(id: string): Promise<BoardRecord | null> {
    const board = this.boards.get(id);
    return board ? { id: board.id, passwordHash: board.passwordHash } : null;
  }
}
