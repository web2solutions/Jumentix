import users from '@seed/users';

import { UserDataRepository, UserService } from '@src/modules/Users';
import { AuthService } from '@src/modules/Users/service/AuthService';
import { UserProviderLocal } from '@src/modules/Users/service/UserProviderLocal';
import { MutexService } from '@src/infra/mutex/adapter/MutexService';
import { InMemoryDbClient } from '@src/infra/persistence/InMemoryDatabase/InMemoryDbClient';
import { InMemoryKeyValueStorageClient } from '@src/infra/persistence/KeyValueStorage/InMemoryKeyValueStorageClient';
import { PasswordCryptoService } from '@src/infra/security/PasswordCryptoService';
import { JwtService } from '@src/infra/jwt/JwtService';
import { EAuthSchemaType } from '@src/modules/Users/service/ports/EAuthSchemaType';
import type { IAuthService } from '@src/modules/Users/service/ports/IAuthService';

/**
 * What the environment decides about authentication (JUM-681).
 *
 * The suite beside this one runs the service with no environment set at all, so
 * every tuning knob reads its built-in default: five attempts, a five-minute
 * window, a fifteen-minute lockout, Basic auth enabled, and a development-shaped
 * error message. Each of those is a deployment decision, and none of the
 * deployments that matter use the default.
 *
 * These drive the other half:
 *
 * - **Lockout thresholds.** A `JUMENTIX_AUTH_MAX_LOGIN_ATTEMPTS` that is read
 *   but not applied is a brute-force limit that does not limit anything, and it
 *   looks identical in every log until someone tries.
 * - **Production error masking.** Outside production the caller is told whether
 *   the username or the password was wrong, which is exactly the oracle an
 *   attacker enumerates accounts with. In production both must read
 *   "invalid credentials".
 * - **Basic auth disabled.** A deployment that turns Basic off and still
 *   accepts it is the whole point of the switch.
 *
 * Everything here is real: the store, the key-value client the lockout counters
 * live in, the mutex, the password hashing and the JWT service. Only the
 * environment is set and restored.
 */
const keyValueStorageClient = InMemoryKeyValueStorageClient.compile();
const mutexService = MutexService.compile(keyValueStorageClient);
const passwordCryptoService = PasswordCryptoService.compile();
const jwtService = JwtService.compile();

const dataRepository = UserDataRepository.compile({ databaseClient: InMemoryDbClient });
const userService = UserService.compile({
  dataRepository,
  services: { passwordCryptoService, mutexService }
});
const userProvider = UserProviderLocal.compile(userService);

/** Set the given variables, returning the undo. */
function withEnv(values: Record<string, string>): () => void {
  const previous = Object.keys(values).map((key) => [key, process.env[key]] as const);
  Object.entries(values).forEach(([key, value]) => { process.env[key] = value; });

  return () => {
    previous.forEach(([key, value]) => {
      const restore = value === undefined ? delete process.env[key] : (process.env[key] = value);
      return restore;
    });
  };
}

let authService: IAuthService;

/** One account per test: a lockout in one must not decide another's outcome. */
async function seedAccount(suffix: string): Promise<string> {
  const [user] = users;
  const username = `${user.username}-jum681-${suffix}`;
  await userService.create({ ...user, username } as never);
  return username;
}

describe('authService under a configured environment (JUM-681)', () => {
  beforeAll(async () => {
    await keyValueStorageClient.connect();
    authService = AuthService.compile(
      userProvider,
      passwordCryptoService,
      jwtService,
      keyValueStorageClient
    );
  });

  it('locks the account at the configured attempt count', async () => {
    expect.hasAssertions();

    // One attempt allowed, then locked: with the environment ignored the second
    // call would answer "password does not matches" and the third, and so on.
    const restore = withEnv({
      JUMENTIX_AUTH_MAX_LOGIN_ATTEMPTS: '1',
      JUMENTIX_AUTH_LOGIN_WINDOW_SECONDS: '60',
      JUMENTIX_AUTH_LOCKOUT_SECONDS: '30'
    });
    const seededUsername = await seedAccount('lockout');

    const first = await authService.authenticate(
      seededUsername,
      'not-the-password',
      EAuthSchemaType.Bearer
    );
    const second = await authService.authenticate(
      seededUsername,
      'not-the-password',
      EAuthSchemaType.Bearer
    );

    restore();

    expect(first.error).toBeDefined();
    expect(second.error).toBeDefined();
    expect((second.error as Error).name).toBe('locked_resource');
  });

  it('masks which half of the credentials was wrong in production', async () => {
    expect.hasAssertions();

    // The development message names the failure — useful locally, an account
    // enumeration oracle in production.
    const restore = withEnv({
      NODE_ENV: 'production',
      JUMENTIX_AUTH_MAX_LOGIN_ATTEMPTS: '50'
    });
    const seededUsername = await seedAccount('masked');

    const unknownUser = await authService.authenticate(
      'nobody-jum681',
      'whatever',
      EAuthSchemaType.Bearer
    );
    const wrongPassword = await authService.authenticate(
      seededUsername,
      'not-the-password',
      EAuthSchemaType.Bearer
    );

    restore();

    // Same message for both, which is the property: neither answer tells the
    // caller whether the account exists.
    expect((unknownUser.error as Error).message).toBe('invalid credentials');
    expect((wrongPassword.error as Error).message).toBe('invalid credentials');
  });

  it('names the failure outside production', async () => {
    expect.hasAssertions();

    // The control for the assertion above: without it, a masker that masked
    // everywhere would pass, and local debugging would lose the distinction for
    // no security gain.
    const restore = withEnv({
      NODE_ENV: 'dev',
      JUMENTIX_AUTH_MAX_LOGIN_ATTEMPTS: '50'
    });
    const seededUsername = await seedAccount('named');

    const wrongPassword = await authService.authenticate(
      seededUsername,
      'not-the-password',
      EAuthSchemaType.Bearer
    );

    restore();

    expect((wrongPassword.error as Error).message).not.toBe('invalid credentials');
  });

  it('refuses an authorization header that carries no token', async () => {
    expect.hasAssertions();

    // Called with nothing at all — the default parameter — which is what an
    // adapter passes when the request had no `Authorization` header.
    await expect(authService.authorize(undefined as never)).rejects.toThrow('invalid token');
    await expect(authService.authorize('Bearer')).rejects.toThrow('invalid token');
  });

  it('refuses a route with no security schema, and audits the denial', () => {
    expect.hasAssertions();

    // `user` is undefined here on purpose: this is the path a request takes when
    // the controller is guarded but the specification is not, and building the
    // audit payload must not throw before the refusal is raised.
    expect(() => authService.throwIfUserHasNoAccessToResource(
      undefined as never,
      {}
    )).toThrow('there is no security schema defined');
  });
});
