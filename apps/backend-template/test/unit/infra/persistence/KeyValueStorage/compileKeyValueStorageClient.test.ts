import { compileKeyValueStorageClient } from '@src/infra/persistence/KeyValueStorage/compileKeyValueStorageClient';
import {
  compileKeyValueStorageClient as compileFromPackage,
  InMemoryKeyValueStorageClient
} from '@jumentix/key-value-storage';

/**
 * `@src/infra/.../compileKeyValueStorageClient` is a single re-export line.
 *
 * The previous version of this suite replaced `@jumentix/key-value-storage` with
 * a mock and then asserted that calling the re-export reached it. That checks
 * that `export { x } from 'y'` works, which is a language guarantee, and it
 * needed `jest.mock` + `jest.requireActual` to do so — neither of which exists
 * under Bun's runner, so the suite ran only under Jest while the test map
 * declared it `runner: bun` (JUM-583).
 *
 * Two claims are worth making instead, and neither needs a mock: the re-export
 * is the same function object as the package's, and the driver selection it
 * exposes actually behaves.
 */
describe('compileKeyValueStorageClient', () => {
  it('re-exports the package function itself, not a wrapper', () => {
    expect.hasAssertions();
    // Identity, so a future wrapper that silently changed behaviour fails here
    // rather than being discovered in production.
    expect(compileKeyValueStorageClient).toBe(compileFromPackage);
  });

  it.each(['InMemory', 'memory', 'in-memory', 'IN-MEMORY', '  memory  '])(
    'selects the in-memory client for %p',
    (driver) => {
      expect.hasAssertions();
      // Case and surrounding whitespace are normalised by the compiler, so the
      // aliases are asserted in the shapes an env var actually arrives in.
      expect(compileKeyValueStorageClient(driver)).toBeInstanceOf(InMemoryKeyValueStorageClient);
    }
  );

  it('does not select the in-memory client for another driver name', () => {
    expect.hasAssertions();
    // The negative case the alias list needs: without it, a compiler that
    // returned the in-memory client unconditionally would satisfy everything
    // above. Redis is the fallback for anything unrecognised.
    expect(compileKeyValueStorageClient('redis')).not.toBeInstanceOf(InMemoryKeyValueStorageClient);
    expect(compileKeyValueStorageClient('something-else')).not.toBeInstanceOf(
      InMemoryKeyValueStorageClient
    );
  });

  describe('with the driver set in the environment', () => {
    // Save and restore in hooks rather than a try/finally in the test: the
    // restore then runs even if the assertion throws, and the test body stays a
    // single claim.
    const previous = process.env.JUMENTIX_KEYVALUESTORAGE_DRIVER;

    beforeEach(() => {
      process.env.JUMENTIX_KEYVALUESTORAGE_DRIVER = 'in-memory';
    });

    afterEach(() => {
      delete process.env.JUMENTIX_KEYVALUESTORAGE_DRIVER;
      Object.assign(
        process.env,
        previous === undefined ? {} : { JUMENTIX_KEYVALUESTORAGE_DRIVER: previous }
      );
    });

    it('reads JUMENTIX_KEYVALUESTORAGE_DRIVER when no driver is passed', () => {
      expect.hasAssertions();

      expect(compileKeyValueStorageClient()).toBeInstanceOf(InMemoryKeyValueStorageClient);
    });
  });
});
