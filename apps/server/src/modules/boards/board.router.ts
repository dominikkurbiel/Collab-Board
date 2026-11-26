import { BOARD_ID_PATTERN } from "@collab-board/shared";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { config } from "../../config.js";
import { publicProcedure, router } from "../../trpc/trpc.js";
import { readAccessToken, setAccessCookie } from "./access-cookie.js";
import { BoardNotFoundError, TooManyAttemptsError, WrongPasswordError } from "./board.errors.js";

const boardId = z.string().regex(BOARD_ID_PATTERN);
const password = z.string().min(4).max(128);

export const boardsRouter = router({
  create: publicProcedure
    .input(z.object({ password: password.optional() }))
    .mutation(async ({ ctx, input }) => {
      const { id, accessToken } = await ctx.boards.create({ password: input.password });
      if (accessToken) setAccessCookie(ctx.res, id, accessToken, config.secureCookies);
      return { id, hasPassword: input.password !== undefined };
    }),

  /** Can the current visitor open this board? Used by the board page before connecting. */
  access: publicProcedure.input(z.object({ boardId })).query(async ({ ctx, input }) => ({
    access: await ctx.boards.getAccess(input.boardId, readAccessToken(ctx.req, input.boardId)),
  })),

  unlock: publicProcedure
    .input(z.object({ boardId, password: z.string().min(1).max(128) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const { accessToken } = await ctx.boards.unlock(input.boardId, input.password, ctx.req.ip);
        setAccessCookie(ctx.res, input.boardId, accessToken, config.secureCookies);
        return { ok: true as const };
      } catch (error) {
        throw toTRPCError(error);
      }
    }),
});

/** Domain errors → tRPC error codes (which map to HTTP 404 / 401 / 429). */
function toTRPCError(error: unknown): unknown {
  if (error instanceof BoardNotFoundError) {
    return new TRPCError({ code: "NOT_FOUND", message: error.message });
  }
  if (error instanceof WrongPasswordError) {
    return new TRPCError({ code: "UNAUTHORIZED", message: error.message });
  }
  if (error instanceof TooManyAttemptsError) {
    const seconds = Math.ceil(error.retryAfterMs / 1000);
    return new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Too many wrong passwords. Try again in ${seconds} s.`,
    });
  }
  return error;
}
