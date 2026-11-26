import { hash, verify } from "@node-rs/argon2";

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
}

/**
 * argon2id, the algorithm recommended by OWASP for storing passwords (and this library's
 * default). It is deliberately slow and memory-hungry, so guessing passwords from a
 * leaked hash is very expensive. The hash string includes a random salt and the
 * parameters, e.g. `$argon2id$v=19$m=19456,t=2,p=1$<salt>$<hash>`.
 */
export class Argon2PasswordHasher implements PasswordHasher {
  hash(password: string): Promise<string> {
    return hash(password);
  }

  async verify(passwordHash: string, password: string): Promise<boolean> {
    try {
      // Compares in constant time, so response timing doesn't leak how close a guess was
      return await verify(passwordHash, password);
    } catch {
      return false; // malformed hash
    }
  }
}
