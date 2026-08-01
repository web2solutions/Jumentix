import { compileAdapterRuntime } from '../src/compileAdapterRuntime';
import type { ICompileAdapterRuntimeOptions } from '../src/compileAdapterRuntime';

/**
 * Requirement 112 — this package owns its suite.
 *
 * The function returns seven things and builds none of them: it decides what
 * gets passed to what. That makes every assertion here an identity assertion,
 * because a version that compiled a second key-value client, or handed the auth
 * composition a fresh mutex, would return an object of exactly the right shape
 * and be wrong in a way no shape check can see.
 *
 * `compileRuntimeInfra` is the real one from `@jumentix/runtime-infra`, not a
 * double. It is a dependency of this package, and replacing it would leave the
 * composition — the only thing this file does — untested.
 */

type Named = { id: string };

const env = (over: Record<string, string> = {}) => over as NodeJS.ProcessEnv;

type Options = ICompileAdapterRuntimeOptions<
  Named, Named, Named, Named, Named, Named, Named
>;

/** Compilers that hand back tagged singletons and record what they receive. */
function harness(over: Partial<Options> = {}) {
  const made = {
    database: { id: 'database' },
    storage: { id: 'storage' },
    mutex: { id: 'mutex' },
    password: { id: 'password' },
    jwt: { id: 'jwt' },
    mediator: { id: 'mediator' },
    auth: { id: 'auth' }
  };

  const seen: { driver?: string; composed?: Record<string, Named> } = {};
  const order: string[] = [];

  const options: Options = {
    compileDatabaseClient: () => {
      order.push('database');
      return made.database;
    },
    compileKeyValueStorageClient: (driver?: string) => {
      order.push('storage');
      seen.driver = driver;
      return made.storage;
    },
    compileMutexService: () => {
      order.push('mutex');
      return made.mutex;
    },
    compilePasswordCryptoService: () => {
      order.push('password');
      return made.password;
    },
    compileJwtService: () => {
      order.push('jwt');
      return made.jwt;
    },
    compileMessageMediator: () => {
      order.push('mediator');
      return made.mediator;
    },
    composeAuthServices: (deps) => {
      order.push('auth');
      seen.composed = deps as unknown as Record<string, Named>;
      return { authService: made.auth };
    },
    env: env(),
    ...over
  };

  return { options, made, seen, order };
}

describe('compileAdapterRuntime', () => {
  it('returns every compiled dependency', () => {
    expect.hasAssertions();

    const { options, made } = harness();

    expect(compileAdapterRuntime(options)).toStrictEqual({
      databaseClient: made.database,
      keyValueStorageClient: made.storage,
      mutexService: made.mutex,
      passwordCryptoService: made.password,
      jwtService: made.jwt,
      messageMediator: made.mediator,
      authService: made.auth
    });
  });

  /**
   * The whole point of the function. Auth services that hold a different mutex
   * or a different storage client than the runtime returns are services
   * coordinating with nobody — and the returned object would look identical.
   */
  it('composes auth from the same instances it returns', () => {
    expect.hasAssertions();

    const { options, seen } = harness();
    const runtime = compileAdapterRuntime(options);

    expect(seen.composed).toStrictEqual({
      databaseClient: runtime.databaseClient,
      passwordCryptoService: runtime.passwordCryptoService,
      mutexService: runtime.mutexService,
      jwtService: runtime.jwtService,
      keyValueStorageClient: runtime.keyValueStorageClient,
      messageMediator: runtime.messageMediator
    });
  });

  it('passes the environment through to the infrastructure compiler', () => {
    expect.hasAssertions();

    const { options, seen } = harness({ env: env({ AAA_KEYVALUESTORAGE_DRIVER: 'redis' }) });
    compileAdapterRuntime(options);

    expect(seen.driver).toBe('redis');
  });

  it('falls back to process.env when none is supplied', () => {
    expect.hasAssertions();

    const previous = { ...process.env };
    process.env.AAA_KEYVALUESTORAGE_DRIVER = 'from-process-env';

    try {
      const { options, seen } = harness({ env: undefined });
      compileAdapterRuntime(options);

      expect(seen.driver).toBe('from-process-env');
    } finally {
      process.env = previous;
    }
  });

  /**
   * Auth is composed last by necessity — it consumes all six. The rest of the
   * order is not arbitrary either: the mutex is built from the storage client,
   * so storage has to precede it, and that relationship lives in
   * `compileRuntimeInfra` rather than here. Asserted so a reordering that
   * happens to still work under these doubles cannot pass silently.
   */
  it('compiles in an order that respects the dependencies', () => {
    expect.hasAssertions();

    const { options, order } = harness();
    compileAdapterRuntime(options);

    expect(order.indexOf('storage')).toBeLessThan(order.indexOf('mutex'));
    expect(order[order.length - 1]).toBe('auth');
  });
});
