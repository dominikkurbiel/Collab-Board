// Brings in @fastify/cookie's types (request.cookies, reply.setCookie) wherever this file is
// type-checked, including the web app, which follows the AppRouter type into the server
import type {} from "@fastify/cookie";
import type { FastifyReply, FastifyRequest } from "fastify";

export const ACCESS_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** One cookie per unlocked board, so unlocking one board doesn't replace another. */
function cookieName(boardId: string): string {
  return `board_access_${boardId}`;
}

export function readAccessToken(request: FastifyRequest, boardId: string): string | undefined {
  return request.cookies[cookieName(boardId)];
}

export function setAccessCookie(
  reply: FastifyReply,
  boardId: string,
  token: string,
  secure: boolean,
): void {
  reply.setCookie(cookieName(boardId), token, {
    httpOnly: true, // JavaScript on the page can't read it, so an XSS bug can't steal it
    secure, // HTTPS only (in production)
    sameSite: "lax", // not sent with requests started by other websites
    path: "/",
    maxAge: ACCESS_TOKEN_TTL_MS / 1000,
  });
}
