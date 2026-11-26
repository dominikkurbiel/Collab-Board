const isProduction = process.env.NODE_ENV === "production";

/** Only for local development; production must set its own secret. */
const DEV_ACCESS_TOKEN_SECRET = "dev-only-secret-change-me-in-production-0123456789";

function accessTokenSecret(): string {
  const secret = process.env.ACCESS_TOKEN_SECRET;
  if (secret) return secret;
  if (isProduction) {
    // Fail fast: with a known default secret anyone could forge board access tokens
    throw new Error("ACCESS_TOKEN_SECRET must be set in production");
  }
  return DEV_ACCESS_TOKEN_SECRET;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  host: process.env.HOST ?? "0.0.0.0",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  logLevel: process.env.LOG_LEVEL ?? "info",
  // Default matches docker-compose.yml (`pnpm services:up`)
  databaseUrl: process.env.DATABASE_URL ?? "postgresql://collab:collab@localhost:5433/collab_board",
  /** Signs board access tokens (HMAC). Generate one with: openssl rand -base64 48 */
  accessTokenSecret: accessTokenSecret(),
  /** Cookies only over HTTPS in production (localhost is plain HTTP). */
  secureCookies: isProduction,
  /** Set TRUST_PROXY=true behind a reverse proxy (Coolify/Traefik), so req.ip is the client's. */
  trustProxy: process.env.TRUST_PROXY === "true",
} as const;
