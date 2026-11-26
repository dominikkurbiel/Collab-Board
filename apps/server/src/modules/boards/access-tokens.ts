import { createHmac, timingSafeEqual } from "node:crypto";

const MIN_SECRET_LENGTH = 32;

/**
 * Proof that someone entered the right password for a board, kept in a cookie.
 *
 * Format: `<boardId>.<expiresAt>.<signature>`, where the signature is an HMAC-SHA256 of
 * the first two parts with a server secret. Changing the board or the expiry breaks the
 * signature, and without the secret nobody can make a new one.
 */
export class AccessTokens {
  constructor(
    private readonly secret: string,
    private readonly ttlMs: number,
  ) {
    if (secret.length < MIN_SECRET_LENGTH) {
      throw new Error(`The token secret must be at least ${MIN_SECRET_LENGTH} characters`);
    }
  }

  issue(boardId: string): string {
    const payload = `${boardId}.${Date.now() + this.ttlMs}`;
    return `${payload}.${this.sign(payload)}`;
  }

  verify(token: string, boardId: string): boolean {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const [tokenBoardId, expiresAtText, signature] = parts as [string, string, string];

    if (tokenBoardId !== boardId) return false;
    const expiresAt = Number(expiresAtText);
    if (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) return false;

    const expected = Buffer.from(this.sign(`${tokenBoardId}.${expiresAtText}`));
    const actual = Buffer.from(signature);
    // Constant-time comparison: a normal === would leak how many characters matched
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  private sign(payload: string): string {
    return createHmac("sha256", this.secret).update(payload).digest("base64url");
  }
}
