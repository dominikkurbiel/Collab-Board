/**
 * Proof that someone entered the right password for a board, kept in a cookie.
 * Signed with a server secret, so it can't be forged or reused for another board.
 */
export class AccessTokens {
  constructor(
    private readonly secret: string,
    private readonly ttlMs: number,
  ) {}

  issue(_boardId: string): string {
    throw new Error("Not implemented");
  }

  verify(_token: string, _boardId: string): boolean {
    throw new Error("Not implemented");
  }
}
