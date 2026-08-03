import { compileRuntimeInfra } from '../src/compileRuntimeInfra';
import type { IRuntimeInfraCompilers } from '../src/compileRuntimeInfra';

/**
 * Requirement 112 — this package owns its suite.
 *
 * `compileRuntimeInfra` is three lines of wiring, which is exactly the shape
 * that gets tested by accident and never on purpose: an application suite
 * exercises it while proving something else, so the wiring is only ever
 * confirmed for the one arrangement that application happens to use.
 *
 * The order is the whole content of the function. The mutex service must be
 * built from the key-value client that was *just* compiled — not from a second
 * one — because the two share a connection, and a mutex holding a different
 * client than the storage it guards is a lock over nothing. That relationship
 * is invisible in the return value, so it is asserted on identity.
 */

/*
 * `{}` is not assignable to `ProcessEnv`: the website workspace ships a
 * `global.d.ts` that makes NODE_ENV required. Bun does not typecheck and Jest
 * does, so an empty literal passes one runner and fails the other.
 */
const env = (over: Record<string, string> = {}) => over as NodeJS.ProcessEnv;

type Client = { id: string };
type Storage = { id: string };
type Mutex = { storage: Storage };

/** Compilers that record what they were handed. */
function recordingCompilers(over: Partial<IRuntimeInfraCompilers<Client, Storage, Mutex>> = {}) {
  const seen: { driver?: string; mutexStorage?: Storage } = {};
  const storage: Storage = { id: 'storage' };

  const compilers: IRuntimeInfraCompilers<Client, Storage, Mutex> = {
    compileDatabaseClient: () => ({ id: 'database' }),
    compileKeyValueStorageClient: (driver?: string) => {
      seen.driver = driver;
      return storage;
    },
    compileMutexService: (keyValueStorageClient: Storage) => {
      seen.mutexStorage = keyValueStorageClient;
      return { storage: keyValueStorageClient };
    },
    ...over
  };

  return { compilers, seen, storage };
}

describe('compileRuntimeInfra', () => {
  it('returns the three dependencies it compiled', () => {
    expect.hasAssertions();

    const { compilers, storage } = recordingCompilers();

    expect(compileRuntimeInfra(compilers, env())).toStrictEqual({
      databaseClient: { id: 'database' },
      keyValueStorageClient: storage,
      mutexService: { storage }
    });
  });

  /**
   * The invariant the function exists for. A mutex built from a second client
   * would still satisfy every type and every shape assertion, and would still
   * be a lock over storage nobody else is using.
   */
  it('gives the mutex the same client instance it just compiled', () => {
    expect.hasAssertions();

    const { compilers, seen, storage } = recordingCompilers();
    const result = compileRuntimeInfra(compilers, env());

    expect(seen.mutexStorage).toBe(storage);
    expect(result.mutexService.storage).toBe(result.keyValueStorageClient);
  });

  it('selects the key-value driver from the environment', () => {
    expect.hasAssertions();

    const { compilers, seen } = recordingCompilers();
    compileRuntimeInfra(compilers, env({ JUMENTIX_KEYVALUESTORAGE_DRIVER: 'redis' }));

    expect(seen.driver).toBe('redis');
  });

  /**
   * Unset must arrive as `undefined`, not as an empty string: the compiler
   * chooses its own default on `undefined`, and `''` is a driver name that
   * matches nothing.
   */
  it('passes undefined when no driver is configured', () => {
    expect.hasAssertions();

    const { compilers, seen } = recordingCompilers();
    compileRuntimeInfra(compilers, env());

    expect(seen.driver).toBeUndefined();
  });

  /**
   * The default argument. Worth its own case because omitting the parameter and
   * passing an empty object are indistinguishable in every other assertion here,
   * and only one of them is what production does.
   */
  it('reads process.env when no environment is supplied', () => {
    expect.hasAssertions();

    const previous = { ...process.env };
    process.env.JUMENTIX_KEYVALUESTORAGE_DRIVER = 'from-process-env';

    try {
      const { compilers, seen } = recordingCompilers();
      compileRuntimeInfra(compilers);

      expect(seen.driver).toBe('from-process-env');
    } finally {
      // Restored by replacement rather than by branching on what was there:
      // the conditional form is what `jest/no-conditional-in-test` objects to,
      // and it hides which of the two paths a run actually took.
      process.env = previous;
    }
  });

  /**
   * The database client is compiled last and depends on nothing here. Asserted
   * because "takes no argument" is a contract the caller relies on: a compiler
   * that started needing the storage would otherwise fail silently at runtime.
   */
  it('compiles the database client without arguments', () => {
    expect.hasAssertions();

    const received: unknown[][] = [];
    const { compilers } = recordingCompilers({
      compileDatabaseClient: (...args: unknown[]) => {
        received.push(args);
        return { id: 'database' };
      }
    });

    compileRuntimeInfra(compilers, env());

    expect(received).toStrictEqual([[]]);
  });
});
