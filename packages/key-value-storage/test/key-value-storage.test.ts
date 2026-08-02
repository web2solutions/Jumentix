/*
 * Two classes, reported at file level: a concrete subclass of the abstract base
 * client, and a Map whose operations throw. Both exist to reach behaviour that
 * cannot be reached otherwise, and both belong next to the blocks that use
 * them rather than in a shared helper away from the reason they exist.
 */
/* eslint-disable max-classes-per-file */
import type { IServiceResponse } from '../src';
import {
  BaseKeyValueStorageClient,
  InMemoryKeyValueStorageClient,
  RedisKeyValueStorageClient,
  ServiceResponse,
  compileKeyValueStorageClient
} from '../src';

/**
 * Requirement 112 — this package owns its suite.
 *
 * Nothing is faked. The in-memory client is a real Map, and the Redis client is
 * the real `redis` client. Everything about Redis that needs a server — its
 * operations, its connection handling, its failure paths — belongs to the
 * integration suite that runs under `RUN_REDIS_INTEGRATION`, and the comment
 * above that describe block records what happened when this file tried to do
 * it without one.
 *
 * Two things shape this file. The clients are module-level singletons, so
 * `compile()` returns the same instance for the life of the process and the
 * tests below assert that rather than working around it. And the key prefix is
 * read from the environment once, in the constructor, so the prefix cases go
 * through a subclass rather than through `compile()`.
 */

/** A concrete client over the abstract base, to reach the base's own behaviour. */
class TestKeyValueStorageClient extends BaseKeyValueStorageClient {
  public store = new Map<string, unknown>();

  public async get(keyName: string): Promise<IServiceResponse> {
    return { result: this.store.get(keyName) };
  }

  public async del(keyName: string): Promise<IServiceResponse> {
    return { result: this.store.delete(keyName) };
  }

  public async set(keyName: string, value: unknown): Promise<IServiceResponse> {
    this.store.set(keyName, value);
    return { result: 'OK' };
  }
}

/** Runs `body` with the environment variable set, and puts it back afterwards. */
async function withEnvironment<T>(
  name: string,
  value: string | undefined,
  body: () => T | Promise<T>
): Promise<T> {
  const previous = process.env[name];

  if (value === undefined) delete process.env[name];
  else process.env[name] = value;

  try {
    return await body();
  } finally {
    if (previous === undefined) delete process.env[name];
    else process.env[name] = previous;
  }
}

describe('the service response', () => {
  it('carries a result', () => {
    expect.hasAssertions();

    expect(new ServiceResponse({ result: { connected: true } }).result)
      .toStrictEqual({ connected: true });
  });

  it('carries an error', () => {
    expect.hasAssertions();

    const failure = new Error('no route to host');

    expect(new ServiceResponse({ error: failure }).error).toBe(failure);
  });

  /**
   * Both fields undefined rather than absent. A caller that checks
   * `'error' in response` would otherwise read a plain success as a failure.
   */
  it('leaves both fields undefined when given neither', () => {
    expect.hasAssertions();

    const response = new ServiceResponse({});

    expect(response.result).toBeUndefined();
    expect(response.error).toBeUndefined();
  });
});

describe('the key prefix', () => {
  /**
   * Every key this package writes is namespaced. Without the prefix, two
   * services sharing a Redis instance overwrite each other's keys silently —
   * and the default matters as much as the override, because most deployments
   * never set the variable.
   */
  it('defaults to aaa__ when the environment names none', async () => {
    expect.hasAssertions();

    const client = await withEnvironment(
      'AAA_KV_KEY_PREFIX',
      undefined,
      () => new TestKeyValueStorageClient()
    );

    expect(client.prefix).toBe('aaa__');
  });

  it('uses the configured prefix, with the separator appended', async () => {
    expect.hasAssertions();

    const client = await withEnvironment(
      'AAA_KV_KEY_PREFIX',
      'orders',
      () => new TestKeyValueStorageClient()
    );

    expect(client.prefix).toBe('orders__');
  });

  it.each([['   '], ['']])('falls back to the default for the prefix %p', async (blank: string) => {
    expect.hasAssertions();

    const client = await withEnvironment(
      'AAA_KV_KEY_PREFIX',
      blank,
      () => new TestKeyValueStorageClient()
    );

    // Whitespace is not a namespace.
    expect(client.prefix).toBe('aaa__');
  });
});

describe('the base client', () => {
  it('starts disconnected', () => {
    expect.hasAssertions();

    expect(new TestKeyValueStorageClient().connected).toBe(false);
  });

  it('reports the new state when connecting', async () => {
    expect.hasAssertions();

    const client = new TestKeyValueStorageClient();

    await expect(client.connect()).resolves
      .toStrictEqual(new ServiceResponse({ result: { connected: true } }));
    expect(client.connected).toBe(true);
  });

  it('reports the new state when disconnecting', async () => {
    expect.hasAssertions();

    const client = new TestKeyValueStorageClient();
    await client.connect();

    await expect(client.disconnect()).resolves
      .toStrictEqual(new ServiceResponse({ result: { connected: false } }));
    expect(client.connected).toBe(false);
  });
});

describe('the in-memory client', () => {
  const client = InMemoryKeyValueStorageClient.compile();

  it('round-trips a value', async () => {
    expect.hasAssertions();

    await client.set('round-trip', { id: 1 });

    await expect(client.get('round-trip')).resolves.toStrictEqual({ result: { id: 1 } });
  });

  it('reports undefined for a key it does not hold', async () => {
    expect.hasAssertions();

    await expect(client.get('never-written')).resolves.toStrictEqual({ result: undefined });
  });

  it('deletes a key and says so', async () => {
    expect.hasAssertions();

    await client.set('to-delete', 'x');

    await expect(client.del('to-delete')).resolves.toStrictEqual({ result: true });
    await expect(client.get('to-delete')).resolves.toStrictEqual({ result: undefined });
  });

  it('reports false when deleting a key it does not hold', async () => {
    expect.hasAssertions();

    await expect(client.del('never-written')).resolves.toStrictEqual({ result: false });
  });

  /**
   * The prefix is applied to the stored key, not only to the argument. A client
   * that forgot it would still pass every round-trip test above while sharing a
   * namespace with everything else in the instance.
   */
  it('stores under the prefixed key', async () => {
    expect.hasAssertions();

    await client.set('prefixed', 'value');

    expect([...client.client.keys()]).toContain(`${client.prefix}:prefixed`);
  });

  it('tracks its connection state', async () => {
    expect.hasAssertions();

    await expect(client.connect()).resolves
      .toStrictEqual(new ServiceResponse({ result: { connected: true } }));
    expect(client.connected).toBe(true);

    await expect(client.disconnect()).resolves
      .toStrictEqual(new ServiceResponse({ result: { connected: false } }));
    expect(client.connected).toBe(false);
  });

  /**
   * The singleton. Two callers must share one Map, or a value written through
   * one is invisible to the other — which for an in-memory store is the whole
   * of its usefulness.
   */
  it('hands every caller the same instance', () => {
    expect.hasAssertions();

    expect(InMemoryKeyValueStorageClient.compile()).toBe(client);
  });
});

/**
 * The error handling, reached the only way it can be.
 *
 * Each operation wraps its Map call in a try/catch that turns a throw into a
 * `ServiceResponse` carrying the error. A `Map` does not throw, so those three
 * branches are unreachable in normal use — but they are not decoration: the
 * client's `client` field is public and typed as a Map, and whatever is in it
 * is what gets called. A real `Map` subclass that throws is exactly that case.
 *
 * The alternative would be to delete the catches as dead code, which is a
 * larger decision than this suite should make on its own: they mirror the shape
 * of the Redis client, where the same calls very much can throw.
 */
describe('the in-memory client when its storage throws', () => {
  /**
   * A real Map whose operations fail.
   *
   * `class-methods-use-this` is suppressed: an override that throws has no use
   * for `this`.
   */
  /* eslint-disable class-methods-use-this */
  class FailingMap extends Map<string, unknown> {
    public get(): never {
      throw new Error('storage failure');
    }

    public set(): never {
      throw new Error('storage failure');
    }

    public delete(): never {
      throw new Error('storage failure');
    }
  }
  /* eslint-enable class-methods-use-this */

  const client = InMemoryKeyValueStorageClient.compile();
  let intact: Map<string, unknown>;

  beforeEach(() => {
    intact = client.client;
    client.client = new FailingMap();
  });

  afterEach(() => {
    client.client = intact;
  });

  it.each([
    ['get', () => client.get('key')],
    ['del', () => client.del('key')],
    ['set', () => client.set('key', 'value')]
  ])('reports the failure from %s rather than throwing it', async (
    _operation: string,
    call: () => Promise<IServiceResponse>
  ) => {
    expect.hasAssertions();

    const response = await call();

    // The error is reported, and no result is invented alongside it.
    expect(response.error).toStrictEqual(new Error('storage failure'));
    expect(response.result).toBeUndefined();
  });
});

describe('choosing a driver', () => {
  it.each(['inmemory', 'in-memory', 'memory', 'InMemory', '  MEMORY  '])(
    'compiles the in-memory client for %p',
    (driver: string) => {
      expect.hasAssertions();

      expect(compileKeyValueStorageClient(driver)).toBe(InMemoryKeyValueStorageClient.compile());
    }
  );

  /**
   * Anything else is Redis, including nothing at all. That is a consequential
   * default — an unset or misspelled variable produces a client that tries to
   * reach a server rather than a silent in-memory store that loses data on
   * restart — so it is asserted rather than assumed.
   */
  it.each([['redis'], ['REDIS'], [''], ['  '], ['in memory'], ['inmemroy']])(
    'compiles the Redis client for %p',
    (driver: string) => {
      expect.hasAssertions();

      expect(compileKeyValueStorageClient(driver)).toBe(RedisKeyValueStorageClient.compile());
    }
  );

  it('reads the driver from the environment when given none', async () => {
    expect.hasAssertions();

    const client = await withEnvironment(
      'AAA_KEYVALUESTORAGE_DRIVER',
      'memory',
      () => compileKeyValueStorageClient()
    );

    expect(client).toBe(InMemoryKeyValueStorageClient.compile());
  });

  it('falls back to Redis when the environment names no driver', async () => {
    expect.hasAssertions();

    const client = await withEnvironment(
      'AAA_KEYVALUESTORAGE_DRIVER',
      undefined,
      () => compileKeyValueStorageClient()
    );

    expect(client).toBe(RedisKeyValueStorageClient.compile());
  });
});

/**
 * The Redis client, as far as it can be taken without a Redis.
 *
 * Only the two facts that hold with no server: the singleton, and the initial
 * state. Its operations are not exercised here on purpose: `redis` reconnects
 * with backoff and no ceiling, and this client sets no connect timeout, so
 * `connect()` against an empty port waits instead of failing. Live behaviour
 * is measured by `test/integration/redis.integration.test.ts` under
 * `RUN_REDIS_INTEGRATION` against a real Redis, and that suite is part of the
 * Jest coverage instrument when the coverage gate brings Redis up (Req 110 /
 * 118) — not excluded by an istanbul ignore.
 */
describe('the Redis client', () => {
  it('hands every caller the same instance', () => {
    expect.hasAssertions();

    // Two connections where the caller believes there is one is the failure
    // this prevents, and it costs a real socket each time.
    expect(RedisKeyValueStorageClient.compile()).toBe(RedisKeyValueStorageClient.compile());
  });

  it('starts disconnected', () => {
    expect.hasAssertions();

    expect(RedisKeyValueStorageClient.compile().connected).toBe(false);
  });
});
