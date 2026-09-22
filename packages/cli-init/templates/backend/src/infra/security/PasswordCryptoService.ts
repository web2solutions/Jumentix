import bcrypt from 'bcryptjs';
import { _BCRYPT_SALT_ROUNDS_ } from '@src/config/constants';
import type { IPasswordCryptoService, IHash, IPasswordHasher } from './IPasswordCryptoService';

let passwordCryptoService: IPasswordCryptoService;

export class PasswordCryptoService implements IPasswordCryptoService {
  private saltRounds: number;

  private hasher: IPasswordHasher;

  /**
   * @param hasher Defaults to `bcryptjs`. Injected only so the error branches
   * are reachable without replacing the module at runtime — see IPasswordHasher.
   */
  constructor(hasher: IPasswordHasher = bcrypt as unknown as IPasswordHasher) {
    this.saltRounds = +(_BCRYPT_SALT_ROUNDS_);
    this.hasher = hasher;
  }

  public async hash(password: string): Promise<IHash> {
    const salt = await this.hasher.genSalt(this.saltRounds);
    // A resolved value of `undefined` should not happen, and the previous cast
    // to IHash made it resolve with `undefined` if it ever did — a stored
    // "password hash" of undefined, reported as success. Rejecting keeps the
    // failure where it happened.
    if (salt === undefined) {
      throw new Error('password hasher returned no salt and no error');
    }
    const hash = await this.hasher.hash(password, salt);
    if (hash === undefined) {
      throw new Error('password hasher returned no hash and no error');
    }
    return { hash, salt };
  }

  public async compare(plainPassword: string, hash: string): Promise<boolean> {
    const result = await this.hasher.compare(plainPassword, hash);
    // Defaulting to `false` rather than resolving `undefined`: a missing
    // result is not a match, and a caller writing `if (await compare(...))`
    // would have treated `undefined` as a rejection anyway — but a caller
    // writing `=== false` would not have.
    return result ?? false;
  }

  public static compile() {
    if (passwordCryptoService) return passwordCryptoService;
    passwordCryptoService = new PasswordCryptoService();
    return passwordCryptoService;
  }
}
