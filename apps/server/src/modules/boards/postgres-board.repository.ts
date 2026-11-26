import { eq } from "drizzle-orm";
import type { Database } from "../../db/client.js";
import { boards } from "./board.schema.js";
import type { BoardRecord, BoardRepository } from "./board.repository.js";

export class PostgresBoardRepository implements BoardRepository {
  constructor(private readonly db: Database) {}

  async create(board: BoardRecord & { state: Uint8Array }): Promise<void> {
    await this.db.insert(boards).values(board);
  }

  async findById(id: string): Promise<BoardRecord | null> {
    const [row] = await this.db
      .select({ id: boards.id, passwordHash: boards.passwordHash })
      .from(boards)
      .where(eq(boards.id, id));
    return row ?? null;
  }
}
