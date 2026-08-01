import * as bcrypt from 'bcryptjs';
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

  private genSalt(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.hasher.genSalt(this.saltRounds, (err: Error | null, salt?: string) => {
        if (err) {
          return reject(err);
        }
        if (salt === undefined) {
          return reject(new Error('password hasher returned no salt and no error'));
        }
        return resolve(salt);
      });
    });
  }

  public hash(password: string): Promise<IHash> {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          const salt = await this.genSalt();
          this.hasher.hash(password, salt, (err: Error | null, hash?: string) => {
            if (err) {
              return reject(err);
            }
            // A callback with neither an error nor a hash should not happen, and
            // the previous cast to IHash made it resolve with `undefined` if it
            // ever did — a stored "password hash" of undefined, reported as
            // success. Rejecting keeps the failure where it happened.
            if (hash === undefined) {
              return reject(new Error('password hasher returned no hash and no error'));
            }
            return resolve({ hash, salt });
          });
        } catch (error) {
          reject(error);
        }
      })();
    });
  }

  public compare(plainPassword: string, hash: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.hasher.compare(plainPassword, hash, (err, result) => {
        if (err) {
          return reject(err);
        }
        // Defaulting to `false` rather than resolving `undefined`: a missing
        // result is not a match, and a caller writing `if (await compare(...))`
        // would have treated `undefined` as a rejection anyway — but a caller
        // writing `=== false` would not have.
        return resolve(result ?? false);
      });
    });
  }

  public static compile() {
    if (passwordCryptoService) return passwordCryptoService;
    passwordCryptoService = new PasswordCryptoService();
    return passwordCryptoService;
  }
}
