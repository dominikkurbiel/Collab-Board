import type { AccessTokens } from "./access-tokens.js";
import type { AttemptLimiter } from "./attempt-limiter.js";
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
  async create(_options: {
    password?: string;
  }): Promise<{ id: string; accessToken: string | null }> {
    throw new Error("Not implemented");
  }

  async getAccess(_boardId: string, _token?: string): Promise<BoardAccess> {
    throw new Error("Not implemented");
  }

  /**
   * Checks the password and returns an access token.
   * @param clientKey identifies who is guessing (e.g. their IP), for rate limiting
   * @throws BoardNotFoundError, WrongPasswordError, TooManyAttemptsError
   */
  async unlock(
    _boardId: string,
    _password: string,
    _clientKey: string,
  ): Promise<{ accessToken: string }> {
    throw new Error("Not implemented");
  }
}
