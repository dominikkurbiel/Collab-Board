import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";

/**
 * Created for every tRPC request. Anything returned here is available
 * in procedures as `ctx` (later: the logged-in user, database client, etc.).
 */
export function createContext({ req, res }: CreateFastifyContextOptions) {
  return { req, res };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
