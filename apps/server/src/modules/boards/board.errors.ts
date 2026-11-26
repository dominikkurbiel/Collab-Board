/** Domain errors: the router maps them to HTTP-like tRPC error codes. */

export class BoardNotFoundError extends Error {
  constructor(boardId: string) {
    super(`Board "${boardId}" not found`);
    this.name = "BoardNotFoundError";
  }
}

export class WrongPasswordError extends Error {
  constructor() {
    super("Wrong password");
    this.name = "WrongPasswordError";
  }
}

export class TooManyAttemptsError extends Error {
  constructor(readonly retryAfterMs: number) {
    super("Too many attempts, try again later");
    this.name = "TooManyAttemptsError";
  }
}
