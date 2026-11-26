/**
 * Where board documents are kept between sessions. The realtime code depends only on
 * this interface, not on PostgreSQL, so tests can use the in-memory version and the
 * database could be swapped without touching rooms.
 */
export interface BoardStorage {
  /** The saved Yjs state of a board, or null if it was never saved. */
  load(boardId: string): Promise<Uint8Array | null>;
  /** Saves the full Yjs state of a board, replacing the previous one. */
  save(boardId: string, state: Uint8Array): Promise<void>;
}
