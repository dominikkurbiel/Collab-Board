import { z } from "zod";
import { publicProcedure, router } from "../../trpc/trpc.js";
import { getHealth } from "./health.js";

export const healthRouter = router({
  check: publicProcedure.query(() => getHealth()),

  hello: publicProcedure
    .input(z.object({ name: z.string().trim().min(1).max(50) }))
    .query(({ input }) => ({ greeting: `Hello, ${input.name}!` })),
});
