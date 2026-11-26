import { defineConfig } from "drizzle-kit";

// Used by the drizzle-kit CLI: `pnpm db:generate` turns schema changes into SQL migrations
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://collab:collab@localhost:5433/collab_board",
  },
});
