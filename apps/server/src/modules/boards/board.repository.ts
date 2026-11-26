export interface BoardRecord {
  id: string;
  /** argon2 hash of the board password, or null for a board anyone with the link can open. */
  passwordHash: string | null;
}

/** Board metadata storage. The service depends on this interface, not on the database. */
export interface BoardRepository {
  create(board: BoardRecord & { state: Uint8Array }): Promise<void>;
  findById(id: string): Promise<BoardRecord | null>;
}
