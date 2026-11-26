export const config = {
  port: Number(process.env.PORT ?? 4000),
  host: process.env.HOST ?? "0.0.0.0",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  logLevel: process.env.LOG_LEVEL ?? "info",
  // Default matches docker-compose.yml (`pnpm services:up`)
  databaseUrl: process.env.DATABASE_URL ?? "postgresql://collab:collab@localhost:5433/collab_board",
} as const;
