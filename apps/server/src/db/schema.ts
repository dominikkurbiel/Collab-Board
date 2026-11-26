import { customType, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** PostgreSQL `bytea` (binary data) mapped to a Uint8Array, the format Yjs works with. */
const bytea = customType<{ data: Uint8Array; driverData: Buffer }>({
  dataType: () => "bytea",
  toDriver: (value) => Buffer.from(value),
  fromDriver: (value) => new Uint8Array(value),
});

export const boards = pgTable("boards", {
  id: text("id").primaryKey(),
  /**
   * The whole Yjs document, encoded with Y.encodeStateAsUpdate. Opaque to the database:
   * it is only ever loaded back into a Y.Doc.
   */
  state: bytea("state").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
