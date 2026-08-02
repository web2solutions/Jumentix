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
 * the real `redis` client. What needs a live server — a successful connection,
 * and the read/write operations themselves — belongs to the integration suite
 * that runs under `RUN_REDIS_INTEGRATION`. What does not need one is covered
 * here: since JUM-597 the client bounds its connect timeout and reconnect
 * attempts, so against a port with nothing listening its operations report a
 * `ServiceResponse.error` within a couple of seconds instead of hanging. The
 * Redis tests below reach that with the real `redis` client, no server, only a
 * port with nothing on it.
 *
 * Two things shape this file. The clients are module-level singletons, so
 * `compile()` returns the same instance for the life of the process and the
 * tests below assert that rather than working around it. A test that needs its
 * own bounded, unreachable endpoint goes through
 * `RedisKeyValueStorageClient.create()` instead of the shared singleton. And
 * the key prefix is read from the environment once, in the constructor, so the
 * prefix cases go through a subclass rather than through `compile()`.
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

/** Runs `body` with the environment variables set, and puts them back afterwards. */
async function withEnvironmentVars<T>(
  entries: Record<string, string | undefined>,
  body: () => T | Promise<T>
): Promise<T> {
  const previous = new Map<string, string | undefined>();

  for (const [name, value] of Object.entries(entries)) {
    previous.set(name, process.env[name]);
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }

  try {
    return await body();
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

/** Runs `body` with the environment variable set, and puts it back afterwards. */
async function withEnvironment<T>(
  name: string,
  value: string | undefined,
  body: () => T | Promise<T>
): Promise<T> {
  return withEnvironmentVars({ [name]: value }, body);
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
      'JUMENTIX_KV_KEY_PREFIX',
      undefined,
      () => new TestKeyValueStorageClient()
    );

    expect(client.prefix).toBe('jumentix__');
  });

  it('uses the configured prefix, with the separator appended', async () => {
    expect.hasAssertions();

    const client = await withEnvironment(
      'JUMENTIX_KV_KEY_PREFIX',
      'orders',
      () => new TestKeyValueStorageClient()
    );

    expect(client.prefix).toBe('orders__');
  });

  it.each([['   '], ['']])('falls back to the default for the prefix %p', async (blank: string) => {
    expect.hasAssertions();

    const client = await withEnvironment(
      'JUMENTIX_KV_KEY_PREFIX',
      blank,
      () => new TestKeyValueStorageClient()
    );

    // Whitespace is not a namespace.
    expect(client.prefix).toBe('jumentix__');
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
      'JUMENTIX_KEYVALUESTORAGE_DRIVER',
      'memory',
      () => compileKeyValueStorageClient()
    );

    expect(client).toBe(InMemoryKeyValueStorageClient.compile());
  });

  it('falls back to Redis when the environment names no driver', async () => {
    expect.hasAssertions();

    const client = await withEnvironment(
      'JUMENTIX_KEYVALUESTORAGE_DRIVER',
      undefined,
      () => compileKeyValueStorageClient()
    );

    expect(client).toBe(RedisKeyValueStorageClient.compile());
  });
});

/**
 * The Redis client, as far as it can be taken without a Redis server.
 *
 * The two facts that need no connection — the singleton, and the initial
 * state — plus the failure path that this file's earlier version could not
 * reach at all.
 *
 * It tried. `redis` reconnects with backoff and no ceiling, and the client
 * then set no connect timeout, so against a port with nothing on it
 * `connect()` did not report a failure — it waited, indefinitely. Assertions
 * written the obvious way ("reports a failure rather than throwing") did not
 * fail; they hung, for thirty seconds each, and took the file from a fraction
 * of a second to two and a half minutes. That is the hang JUM-597 was filed
 * about, and the fix is what makes these tests possible: the client now bounds
 * its connect timeout and reconnect attempts, so an unreachable server rejects
 * `connect()` instead of stalling it, and `get`/`set`/`del` pass that failure
 * back as a `ServiceResponse.error`.
 *
 * Every test here uses the real `redis` client. It needs no server, only a
 * port with nothing listening, and a bounded configuration so the failure
 * lands in milliseconds rather than the five-second default. The success paths
 * — a real connect, real reads and writes — belong to
 * `test/integration/redis.integration.test.ts` under `RUN_REDIS_INTEGRATION`
 * against a real server, and that suite is part of the Jest coverage
 * instrument when the coverage gate brings Redis up (Req 110 / 118). Those
 * lines are measured, not excluded by istanbul ignore.
 */
const UNREACHABLE_REDIS_ENV = {
  JUMENTIX_REDIS_HOST: '127.0.0.1',
  JUMENTIX_REDIS_PORT: '5999',
  JUMENTIX_REDIS_CONNECT_TIMEOUT_MS: '100',
  JUMENTIX_REDIS_MAX_RECONNECT_ATTEMPTS: '1'
};

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

  it('sets a bounded connect timeout and a reconnect ceiling by default', () => {
    expect.hasAssertions();

    const socket = RedisKeyValueStorageClient.create().client.options.socket as any;

    expect(socket.host).toBe('127.0.0.1');
    expect(socket.port).toBe(6379);
    expect(socket.connectTimeout).toBe(5000);
    expect(typeof socket.reconnectStrategy).toBe('function');
  });

  it('reads the timeout and reconnect budget from the environment', async () => {
    expect.hasAssertions();

    const client = await withEnvironmentVars({
      JUMENTIX_REDIS_HOST: 'localhost',
      JUMENTIX_REDIS_PORT: '6380',
      JUMENTIX_REDIS_DB: '2',
      JUMENTIX_REDIS_CONNECT_TIMEOUT_MS: '750',
      JUMENTIX_REDIS_MAX_RECONNECT_ATTEMPTS: '5'
    }, () => RedisKeyValueStorageClient.create());
    const socket = client.client.options.socket as any;

    expect(socket.host).toBe('localhost');
    expect(socket.port).toBe(6380);
    expect(client.client.options.database).toBe(2);
    expect(socket.connectTimeout).toBe(750);
  });

  it('falls back to the defaults when the timeout environment is malformed', async () => {
    expect.hasAssertions();

    const client = await withEnvironmentVars({
      JUMENTIX_REDIS_CONNECT_TIMEOUT_MS: 'not-a-number',
      JUMENTIX_REDIS_MAX_RECONNECT_ATTEMPTS: '0'
    }, () => RedisKeyValueStorageClient.create());

    expect((client.client.options.socket as any).connectTimeout).toBe(5000);
  });

  it('reports a connection failure within a bounded time against an unreachable port', async () => {
    expect.hasAssertions();

    const client = await withEnvironmentVars(
      UNREACHABLE_REDIS_ENV,
      () => RedisKeyValueStorageClient.create()
    );
    const startedAt = Date.now();

    const response = await client.connect();

    expect(Date.now() - startedAt).toBeLessThan(2000);
    expect(response.error).toBeInstanceOf(Error);
    expect(response.result).toBeUndefined();
  });

  it.each([
    ['get', (client: RedisKeyValueStorageClient) => client.get('key')],
    ['del', (client: RedisKeyValueStorageClient) => client.del('key')],
    ['set', (client: RedisKeyValueStorageClient) => client.set('key', 'value')]
  ])('reports %s failing fast against an unreachable port rather than hanging', async (
    _operation: string,
    call: (client: RedisKeyValueStorageClient) => Promise<IServiceResponse>
  ) => {
    expect.hasAssertions();

    const client = await withEnvironmentVars(
      UNREACHABLE_REDIS_ENV,
      () => RedisKeyValueStorageClient.create()
    );
    const startedAt = Date.now();

    const response = await call(client);

    expect(Date.now() - startedAt).toBeLessThan(2000);
    expect(response.error).toBeInstanceOf(Error);
    expect(response.result).toBeUndefined();
  });

  it('reports an error from disconnect when the client was never connected', async () => {
    expect.hasAssertions();

    const client = await withEnvironmentVars(
      UNREACHABLE_REDIS_ENV,
      () => RedisKeyValueStorageClient.create()
    );

    const response = await client.disconnect();

    expect(response.error).toBeInstanceOf(Error);
    expect(response.result).toBeUndefined();
  });
});
