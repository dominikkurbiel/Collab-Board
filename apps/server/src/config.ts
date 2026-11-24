export const config = {
  port: Number(process.env.PORT ?? 4000),
  host: process.env.HOST ?? "0.0.0.0",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  logLevel: process.env.LOG_LEVEL ?? "info",
} as const;
