import { eq, sql } from "drizzle-orm";
import type { Database } from "../../db/client.js";
import type { BoardStorage } from "../realtime/index.js";
import { boards } from "./board.schema.js";

/**
 * Adapter: implements the realtime module's BoardStorage port on top of the boards table.
 */
export class PostgresBoardStorage implements BoardStorage {
  constructor(private readonly db: Database) {}

  async load(boardId: string): Promise<Uint8Array | null> {
    const [row] = await this.db
      .select({ state: boards.state })
      .from(boards)
      .where(eq(boards.id, boardId));
    return row?.state ?? null;
  }

  async save(boardId: string, state: Uint8Array): Promise<void> {
    // "Upsert": insert the board, or update it if the id already exists, in one query
    await this.db
      .insert(boards)
      .values({ id: boardId, state })
      .onConflictDoUpdate({
        target: boards.id,
        set: { state, updatedAt: sql`now()` },
      });
  }
}
