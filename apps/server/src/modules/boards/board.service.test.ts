import { BOARD_ID_PATTERN, DEMO_BOARD_ID } from "@collab-board/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { AccessTokens } from "./access-tokens.js";
import { AttemptLimiter } from "./attempt-limiter.js";
import { BoardNotFoundError, TooManyAttemptsError, WrongPasswordError } from "./board.errors.js";
import { BoardService } from "./board.service.js";
import { MemoryBoardRepository } from "./memory-board.repository.js";
import { Argon2PasswordHasher } from "./password-hasher.js";

const MAX_ATTEMPTS = 3;

let repository: MemoryBoardRepository;
let service: BoardService;

beforeEach(() => {
  repository = new MemoryBoardRepository();
  service = new BoardService({
    repository,
    passwords: new Argon2PasswordHasher(),
    tokens: new AccessTokens("test-secret-at-least-32-characters-long", 60_000),
    limiter: new AttemptLimiter(MAX_ATTEMPTS, 60_000),
  });
});

describe("creating a board", () => {
  it("gives it a random, URL-safe id", async () => {
    const a = await service.create({});
    const b = await service.create({});

    expect(a.id).toMatch(BOARD_ID_PATTERN);
    expect(a.id.length).toBeGreaterThanOrEqual(20); // long enough not to be guessed
    expect(a.id).not.toBe(b.id);
  });

  it("without a password: anyone with the link can open it", async () => {
    const { id, accessToken } = await service.create({});

    expect(accessToken).toBeNull();
    expect(await service.getAccess(id)).toBe("granted");
  });

  it("with a password: others need the password", async () => {
    const { id } = await service.create({ password: "secret" });
    expect(await service.getAccess(id)).toBe("password-required");
  });

  it("with a password: the creator gets in without typing it again", async () => {
    const { id, accessToken } = await service.create({ password: "secret" });

    expect(accessToken).not.toBeNull();
    expect(await service.getAccess(id, accessToken ?? undefined)).toBe("granted");
  });

  it("never stores the password itself", async () => {
    const { id } = await service.create({ password: "my-secret-password" });
    const { passwordHash } = repository.boards.get(id)!;

    expect(passwordHash).not.toBeNull();
    expect(passwordHash).not.toContain("my-secret-password");
    expect(passwordHash).toMatch(/^\$argon2id\$/);
  });

  it("starts with an empty document", async () => {
    const { id } = await service.create({});
    expect(repository.boards.get(id)!.state).toBeInstanceOf(Uint8Array);
  });
});

describe("opening a board", () => {
  it("reports unknown boards as not found", async () => {
    expect(await service.getAccess("does-not-exist")).toBe("not-found");
  });

  it("always lets everyone into the public demo board", async () => {
    expect(await service.getAccess(DEMO_BOARD_ID)).toBe("granted");
  });

  it("rejects a token that belongs to another board", async () => {
    const first = await service.create({ password: "secret" });
    const second = await service.create({ password: "secret" });

    expect(await service.getAccess(second.id, first.accessToken ?? undefined)).toBe(
      "password-required",
    );
  });

  it("rejects a forged token", async () => {
    const { id } = await service.create({ password: "secret" });
    expect(await service.getAccess(id, `${id}.9999999999999.forged-signature`)).toBe(
      "password-required",
    );
  });
});

describe("unlocking with a password", () => {
  it("returns a token that opens the board", async () => {
    const { id } = await service.create({ password: "secret" });
    const { accessToken } = await service.unlock(id, "secret", "1.2.3.4");

    expect(await service.getAccess(id, accessToken)).toBe("granted");
  });

  it("rejects a wrong password", async () => {
    const { id } = await service.create({ password: "secret" });
    await expect(service.unlock(id, "wrong", "1.2.3.4")).rejects.toThrow(WrongPasswordError);
  });

  it("fails for an unknown board", async () => {
    await expect(service.unlock("nope", "secret", "1.2.3.4")).rejects.toThrow(BoardNotFoundError);
  });

  it("blocks guessing after too many wrong passwords, even the right one", async () => {
    const { id } = await service.create({ password: "secret" });
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await expect(service.unlock(id, `guess-${i}`, "1.2.3.4")).rejects.toThrow(WrongPasswordError);
    }

    await expect(service.unlock(id, "secret", "1.2.3.4")).rejects.toThrow(TooManyAttemptsError);
  });

  it("limits each client separately", async () => {
    const { id } = await service.create({ password: "secret" });
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await expect(service.unlock(id, "wrong", "attacker")).rejects.toThrow(WrongPasswordError);
    }

    await expect(service.unlock(id, "secret", "someone-else")).resolves.toBeDefined();
  });
});
