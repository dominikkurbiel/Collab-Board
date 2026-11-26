import { DEMO_BOARD_ID } from "@collab-board/shared";
import { randomBytes } from "node:crypto";
import * as Y from "yjs";
import type { AccessTokens } from "./access-tokens.js";
import type { AttemptLimiter } from "./attempt-limiter.js";
import { BoardNotFoundError, TooManyAttemptsError, WrongPasswordError } from "./board.errors.js";
import type { BoardRepository } from "./board.repository.js";
import type { PasswordHasher } from "./password-hasher.js";

/**
 * - granted:           can open the board
 * - password-required: the board exists, but needs its password (or a valid token)
 * - not-found:         no such board
 */
export type BoardAccess = "granted" | "password-required" | "not-found";

export interface BoardServiceDeps {
  repository: BoardRepository;
  passwords: PasswordHasher;
  tokens: AccessTokens;
  limiter: AttemptLimiter;
}

/** Creating boards and deciding who may open them. */
export class BoardService {
  constructor(private readonly deps: BoardServiceDeps) {}

  /**
   * Creates a board, optionally protected by a password. The creator gets an access
   * token right away, so they don't have to type the password they just chose.
   */
  async create({
    password,
  }: {
    password?: string;
  }): Promise<{ id: string; accessToken: string | null }> {
    const id = generateBoardId();
    const passwordHash = password ? await this.deps.passwords.hash(password) : null;
    await this.deps.repository.create({
      id,
      passwordHash,
      state: Y.encodeStateAsUpdate(new Y.Doc()),
    });
    return { id, accessToken: passwordHash ? this.deps.tokens.issue(id) : null };
  }

  async getAccess(boardId: string, token?: string): Promise<BoardAccess> {
    if (boardId === DEMO_BOARD_ID) return "granted";

    const board = await this.deps.repository.findById(boardId);
    if (!board) return "not-found";
    if (!board.passwordHash) return "granted";
    return token && this.deps.tokens.verify(token, boardId) ? "granted" : "password-required";
  }

  /**
   * Checks the password and returns an access token.
   * @param clientKey identifies who is guessing (e.g. their IP), for rate limiting
   * @throws BoardNotFoundError, WrongPasswordError, TooManyAttemptsError
   */
  async unlock(
    boardId: string,
    password: string,
    clientKey: string,
  ): Promise<{ accessToken: string }> {
    // Limit per client AND board: an attacker can't lock out other people
    const limitKey = `${clientKey}:${boardId}`;
    const retryAfterMs = this.deps.limiter.retryAfter(limitKey);
    if (retryAfterMs > 0) throw new TooManyAttemptsError(retryAfterMs);

    const board = await this.deps.repository.findById(boardId);
    if (!board) throw new BoardNotFoundError(boardId);

    if (board.passwordHash && !(await this.deps.passwords.verify(board.passwordHash, password))) {
      this.deps.limiter.fail(limitKey);
      throw new WrongPasswordError();
    }

    this.deps.limiter.reset(limitKey);
    return { accessToken: this.deps.tokens.issue(boardId) };
  }
}

/** 16 random bytes as base64url: 22 URL-safe characters, practically impossible to guess. */
function generateBoardId(): string {
  return randomBytes(16).toString("base64url");
}
