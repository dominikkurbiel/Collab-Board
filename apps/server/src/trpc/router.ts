import { boardsRouter } from "../modules/boards/index.js";
import { healthRouter } from "../modules/health/index.js";
import { router } from "./trpc.js";

export const appRouter = router({
  health: healthRouter,
  boards: boardsRouter,
});

/** Only the TYPE is shared with the frontend, never the server code itself. */
export type AppRouter = typeof appRouter;
