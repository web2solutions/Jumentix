export interface IHash {
  hash: string;
  salt: string;
}

export interface IPasswordCryptoService {
  hash(password: string): Promise<IHash>;
  compare(plainPassword: string, hash: string): Promise<boolean>;
}

/**
 * The part of `bcryptjs` this service uses.
 *
 * Declared as a port so the error branches can be driven directly. They were
 * previously reached by replacing the `bcryptjs` module at runtime, which is not
 * portable: `jest.doMock` does not exist under Bun's runner, and `spyOn` against
 * an ESM namespace works under Bun but is rejected by Jest as an assignment to a
 * read-only property. A suite that has to pick a runner is a suite that stops
 * running on the other one (JUM-583).
 *
 * bcryptjs@3 exposes a Promise-based async API (callbacks were removed). The
 * port matches that surface so the production default remains a thin wrap.
 */
export interface IPasswordHasher {
  genSalt(rounds: number): Promise<string>;
  hash(password: string, salt: string): Promise<string>;
  compare(plainPassword: string, hash: string): Promise<boolean>;
}
