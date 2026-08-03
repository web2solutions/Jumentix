import {
  REST_API_ADAPTERS,
  startRestApiAdapter
} from '@src/interface/HTTP/adapters/start-rest-api';
import { resolveHTTPFramework } from '@src/interface/runtime/RuntimeEnvironment';

/**
 * Which adapter the loader selects, observed through the injected table.
 *
 * The adapters are never really imported here — importing one starts a real HTTP
 * server on a real port. That was previously prevented by replacing each adapter
 * module with `jest.doMock` and reloading the loader through
 * `jest.resetModules()`, neither of which exists under Bun's runner, so this
 * suite ran only under Jest while the test map declared it `runner: bun`
 * (JUM-583).
 */

/** A stand-in table that records the selection instead of performing it. */
function recordingAdapters(): {
  adapters: Record<string, () => Promise<unknown>>;
  loaded: string[];
  } {
  const loaded: string[] = [];
  const adapters = Object.fromEntries(
    Object.keys(REST_API_ADAPTERS).map((name) => [
      name,
      () => {
        loaded.push(name);
        return Promise.resolve({});
      }
    ])
  );
  return { adapters, loaded };
}

describe('start-rest-api adapter loader', () => {
  const previousFramework = process.env.JUMENTIX_HTTP_FRAMEWORK;

  afterEach(() => {
    if (previousFramework === undefined) delete process.env.JUMENTIX_HTTP_FRAMEWORK;
    else process.env.JUMENTIX_HTTP_FRAMEWORK = previousFramework;
  });

  it.each(Object.keys(REST_API_ADAPTERS))('loads the %s adapter and no other', async (framework) => {
    expect.hasAssertions();
    const { adapters, loaded } = recordingAdapters();

    await startRestApiAdapter(
      { JUMENTIX_HTTP_FRAMEWORK: framework } as unknown as NodeJS.ProcessEnv,
      adapters
    );

    // Asserting the whole list, not just that the right one ran: a loader that
    // started every adapter would satisfy a `toContain`.
    expect(loaded).toStrictEqual([framework]);
  });

  it('throws for an unsupported framework', async () => {
    expect.hasAssertions();
    const { adapters } = recordingAdapters();

    await expect(startRestApiAdapter(
      { JUMENTIX_HTTP_FRAMEWORK: 'unknown-http' } as unknown as NodeJS.ProcessEnv,
      adapters
    )).rejects.toThrow('Unsupported JUMENTIX_HTTP_FRAMEWORK');
  });

  it('uses process env when the env argument is omitted', async () => {
    expect.hasAssertions();
    process.env.JUMENTIX_HTTP_FRAMEWORK = 'express';
    const { adapters, loaded } = recordingAdapters();

    await startRestApiAdapter(undefined, adapters);

    expect(loaded).toStrictEqual(['express']);
  });

  it('throws rather than starting nothing when a framework has no adapter row', async () => {
    expect.hasAssertions();
    // The drift case. `resolveHTTPFramework` and `REST_API_ADAPTERS` are two
    // lists that must agree; where they did not, the old if-chain fell off the
    // end and resolved successfully with no server running.
    await expect(startRestApiAdapter(
      { JUMENTIX_HTTP_FRAMEWORK: 'express' } as unknown as NodeJS.ProcessEnv,
      {}
    )).rejects.toThrow('No adapter registered');
  });

  it('registers an adapter for every framework RuntimeEnvironment accepts', () => {
    expect.hasAssertions();
    // The standing guard against that drift, rather than a test of one instance
    // of it: every name the environment resolver admits must have a row.
    const unregistered = Object.keys(REST_API_ADAPTERS).filter((framework) => {
      const resolved = resolveHTTPFramework(
        { JUMENTIX_HTTP_FRAMEWORK: framework } as unknown as NodeJS.ProcessEnv
      );
      return REST_API_ADAPTERS[resolved] === undefined;
    });

    expect(unregistered).toStrictEqual([]);
  });
});
