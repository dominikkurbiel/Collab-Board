import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";
import type { BoardService } from "../modules/boards/index.js";

/** Services that procedures can use, created once in app.ts (dependency injection). */
export interface ContextServices {
  boards: BoardService;
}

/**
 * Returns the function that tRPC calls for every request. Anything it returns is
 * available in procedures as `ctx`: the request/reply and the services.
 */
export function createContextFactory(services: ContextServices) {
  return ({ req, res }: CreateFastifyContextOptions) => ({ req, res, ...services });
}

export type Context = ReturnType<ReturnType<typeof createContextFactory>>;
