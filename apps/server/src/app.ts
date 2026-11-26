import cors from "@fastify/cors";
import { fastifyTRPCPlugin, type FastifyTRPCPluginOptions } from "@trpc/server/adapters/fastify";
import Fastify from "fastify";
import { config } from "./config.js";
import { createDatabase } from "./db/client.js";
import { PostgresBoardStorage } from "./modules/boards/index.js";
import { getHealth } from "./modules/health/index.js";
import { realtimePlugin } from "./modules/realtime/index.js";
import { createContext } from "./trpc/context.js";
import { appRouter, type AppRouter } from "./trpc/router.js";

export async function buildApp() {
  const app = Fastify({
    logger: { level: config.logLevel },
    // tRPC batches several calls into one URL, which can get long
    routerOptions: { maxParamLength: 5000 },
  });

  await app.register(cors, { origin: config.corsOrigin });

  // Plain REST endpoint for infrastructure (Docker / Coolify health checks)
  app.get("/health", async () => getHealth());

  await app.register(fastifyTRPCPlugin, {
    prefix: "/trpc",
    trpcOptions: {
      router: appRouter,
      createContext,
      onError({ path, error }) {
        app.log.error({ path, err: error }, "tRPC error");
      },
    } satisfies FastifyTRPCPluginOptions<AppRouter>["trpcOptions"],
  });

  // PostgreSQL: apply pending migrations on startup, so a deploy is just "start the server"
  const database = createDatabase(config.databaseUrl);
  await database.migrate();
  app.addHook("onClose", () => database.close());

  // Live collaboration over WebSockets (Yjs), saved in PostgreSQL
  await app.register(realtimePlugin, { storage: new PostgresBoardStorage(database.db) });

  return app;
}
