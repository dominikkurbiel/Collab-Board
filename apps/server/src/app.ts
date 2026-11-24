import cors from "@fastify/cors";
import Fastify from "fastify";
import type { HealthResponse } from "@collab-board/shared";
import { config } from "./config.js";

export async function buildApp() {
  const app = Fastify({
    logger: { level: config.logLevel },
  });

  await app.register(cors, { origin: config.corsOrigin });

  app.get("/health", async (): Promise<HealthResponse> => ({
    status: "ok",
    service: "collab-board-server",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  }));

  return app;
}
