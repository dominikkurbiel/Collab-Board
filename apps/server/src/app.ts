import cors from "@fastify/cors";
import { fastifyTRPCPlugin, type FastifyTRPCPluginOptions } from "@trpc/server/adapters/fastify";
import Fastify from "fastify";
import { config } from "./config.js";
import { getHealth } from "./health.js";
import { realtimePlugin } from "./realtime/plugin.js";
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

  // Live collaboration over WebSockets (Yjs)
  await app.register(realtimePlugin);

  return app;
}
