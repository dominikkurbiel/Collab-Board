import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import { fastifyTRPCPlugin, type FastifyTRPCPluginOptions } from "@trpc/server/adapters/fastify";
import Fastify from "fastify";
import { config } from "./config.js";
import { createDatabase } from "./db/client.js";
import {
  ACCESS_TOKEN_TTL_MS,
  AccessTokens,
  Argon2PasswordHasher,
  AttemptLimiter,
  BoardService,
  PostgresBoardRepository,
  PostgresBoardStorage,
  readAccessToken,
} from "./modules/boards/index.js";
import { getHealth } from "./modules/health/index.js";
import { realtimePlugin } from "./modules/realtime/index.js";
import { createContextFactory } from "./trpc/context.js";
import { appRouter, type AppRouter } from "./trpc/router.js";

/** Wrong board passwords allowed per client and board, per minute. */
const MAX_PASSWORD_ATTEMPTS = 5;

/**
 * Composition root: the one place that creates the dependencies (database, services)
 * and wires the modules together. Modules themselves never create their dependencies.
 */
export async function buildApp() {
  const app = Fastify({
    logger: { level: config.logLevel },
    // tRPC batches several calls into one URL, which can get long
    routerOptions: { maxParamLength: 5000 },
    // Behind a reverse proxy (production), take the client IP from X-Forwarded-For
    trustProxy: config.trustProxy,
  });

  // PostgreSQL: apply pending migrations on startup, so a deploy is just "start the server"
  const database = createDatabase(config.databaseUrl);
  await database.migrate();
  app.addHook("onClose", () => database.close());

  const boards = new BoardService({
    repository: new PostgresBoardRepository(database.db),
    passwords: new Argon2PasswordHasher(),
    tokens: new AccessTokens(config.accessTokenSecret, ACCESS_TOKEN_TTL_MS),
    limiter: new AttemptLimiter(MAX_PASSWORD_ATTEMPTS, 60_000),
  });

  await app.register(cookie);
  // credentials: the browser may send and receive cookies (board access) cross-origin
  await app.register(cors, { origin: config.corsOrigin, credentials: true });

  // Plain REST endpoint for infrastructure (Docker / Coolify health checks)
  app.get("/health", async () => getHealth());

  await app.register(fastifyTRPCPlugin, {
    prefix: "/trpc",
    trpcOptions: {
      router: appRouter,
      createContext: createContextFactory({ boards }),
      onError({ path, error }) {
        // Expected errors (wrong password, not found) are not worth an error log
        if (error.code === "INTERNAL_SERVER_ERROR") {
          app.log.error({ path, err: error }, "tRPC error");
        }
      },
    } satisfies FastifyTRPCPluginOptions<AppRouter>["trpcOptions"],
  });

  // Live collaboration over WebSockets (Yjs), saved in PostgreSQL. The realtime module
  // doesn't know about passwords: it asks the boards module through checkAccess.
  await app.register(realtimePlugin, {
    storage: new PostgresBoardStorage(database.db),
    checkAccess: (boardId, request) => boards.getAccess(boardId, readAccessToken(request, boardId)),
  });

  return app;
}
