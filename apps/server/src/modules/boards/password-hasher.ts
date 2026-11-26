export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
}

/** argon2id, the algorithm recommended by OWASP for storing passwords. */
export class Argon2PasswordHasher implements PasswordHasher {
  async hash(_password: string): Promise<string> {
    throw new Error("Not implemented");
  }

  async verify(_hash: string, _password: string): Promise<boolean> {
    throw new Error("Not implemented");
  }
}
