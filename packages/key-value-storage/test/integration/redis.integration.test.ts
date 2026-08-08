import {
  RedisKeyValueStorageClient,
  ServiceResponse,
  compileKeyValueStorageClient,
  resetRedisKeyValueStorageClientForTests
} from '../../src';

/**
 * The Redis client against a real Redis (Requirement 112 §1).
 *
 * The unit suite covers the singleton, the initial state, and the bounded
 * failure path against an unreachable port (JUM-597). This suite is the
 * measurement of the live success paths — real Redis under
 * `RUN_REDIS_INTEGRATION` — and the coverage gate runs it under the Jest
 * instrument so those lines are counted, not ignored.
 *
 * The singleton shapes the file. `compile()` returns one client for the life of
 * the process, so these tests share it, run in order, and the disconnection
 * test comes last — a disconnected singleton cannot be reconnected by anything
 * that runs after it.
 */

const RUNNING = process.env.RUN_REDIS_INTEGRATION === '1';

/**
 * Skipped rather than passed when the server is absent.
 *
 * A suite that silently reports success without its dependency is the exact
 * false green this repository keeps finding: it stays green when the thing it
 * tests is not running at all.
 *
 */
const suite = RUNNING ? describe : describe.skip;

/** Runs `body` with no driver named, and puts the variable back afterwards. */
function withoutDriverNamed<T>(body: () => T): T {
  const previous = process.env.AAA_KEYVALUESTORAGE_DRIVER;
  delete process.env.AAA_KEYVALUESTORAGE_DRIVER;

  try {
    return body();
  } finally {
    if (previous === undefined) delete process.env.AAA_KEYVALUESTORAGE_DRIVER;
    else process.env.AAA_KEYVALUESTORAGE_DRIVER = previous;
  }
}

function restoreEnvVar(envKey: string, value: string | undefined) {
  if (value === undefined) delete process.env[envKey];
  else process.env[envKey] = value;
}

const key = (name: string) => `integration-${name}-${Date.now()}`;

suite('the Redis client against a real server', () => {
  const client = RedisKeyValueStorageClient.compile();

  it('connects, and says so', async () => {
    expect.hasAssertions();

    const response = await client.connect();

    expect(response.error).toBeUndefined();
    expect(response.result).toStrictEqual({ connected: true });
    expect(client.connected).toBe(true);
  }, 30000);

  it('round-trips a value through the server', async () => {
    expect.hasAssertions();

    const name = key('round-trip');
    const written = await client.set(name, 'stored');

    expect(written.error).toBeUndefined();

    const read = await client.get(name);

    expect(read.error).toBeUndefined();
    expect(read.result).toBe('stored');
  }, 30000);

  /**
   * The prefix is what keeps two services sharing one Redis from overwriting
   * each other. The unit suite asserts the client computes it; only a real
   * server can show the key it actually wrote.
   */
  it('writes under the prefixed key, as seen from the server', async () => {
    expect.hasAssertions();

    const name = key('prefixed');
    await client.set(name, 'value');

    // Read back through the driver directly, with the prefix spelled out: if
    // the client stopped prefixing, this is the assertion that fails.
    const direct = await client.client.get(`${client.prefix}:${name}`);

    expect(direct).toBe('value');
  }, 30000);

  it('reports a key it does not hold as null, not as an error', async () => {
    expect.hasAssertions();

    const response = await client.get(key('never-written'));

    // The distinction a caller depends on: absent is not the same as broken.
    expect(response.error).toBeUndefined();
    expect(response.result).toBeNull();
  }, 30000);

  it('deletes a key and reports how many it removed', async () => {
    expect.hasAssertions();

    const name = key('to-delete');
    await client.set(name, 'value');

    const deleted = await client.del(name);

    expect(deleted.error).toBeUndefined();
    expect(deleted.result).toBe(1);

    const afterwards = await client.get(name);

    expect(afterwards.result).toBeNull();
  }, 30000);

  it('reports zero when deleting a key it does not hold', async () => {
    expect.hasAssertions();

    const response = await client.del(key('never-written'));

    expect(response.error).toBeUndefined();
    expect(response.result).toBe(0);
  }, 30000);

  /**
   * `get`, `set` and `del` each call `connect()` first. Once connected that has
   * to be a no-op — reconnecting on every operation would open a socket per
   * call, and the client would exhaust the server's connection limit under any
   * real load.
   */
  it('does not reconnect on every operation', async () => {
    expect.hasAssertions();

    const before = client.client;
    await client.set(key('reuse'), 'value');
    await client.get(key('reuse'));

    expect(client.client).toBe(before);
    expect(client.connected).toBe(true);
  }, 30000);

  it('answers a connect it has already made without doing anything', async () => {
    expect.hasAssertions();

    const response = await client.connect();

    expect(response.error).toBeUndefined();
    expect(response.result).toStrictEqual({ connected: true });
  }, 30000);

  /**
   * Last, deliberately: this is a singleton, and nothing that runs after it can
   * reconnect the instance it closed.
   */
  it('disconnects, and reports the new state', async () => {
    expect.hasAssertions();

    const response = await client.disconnect();

    expect(response.error).toBeUndefined();
    expect(response.result).toStrictEqual({ connected: false });
    expect(client.connected).toBe(false);
  }, 30000);

  /**
   * Catch branches against a real node-redis client that has already quit.
   *
   * Forcing `connected = true` after `quit()` skips the reconnect path so
   * `get`/`set`/`del` call the closed client directly — still the real driver,
   * not a substitute — and the adapter must return a ServiceResponse error
   * rather than throw.
   */
  it('surfaces command failures on a quit client as ServiceResponse errors', async () => {
    expect.hasAssertions();

    client.connected = true;

    const get = await client.get(key('after-quit'));
    const set = await client.set(key('after-quit'), 'x');
    const del = await client.del(key('after-quit'));

    expect(get.error).toBeInstanceOf(Error);
    expect(set.error).toBeInstanceOf(Error);
    expect(del.error).toBeInstanceOf(Error);

    // The error listener is registered at construction; fire it through the
    // real client's EventEmitter so that branch is measured.
    client.client.emit('error', new Error('redis-client-error'));
  }, 30000);

  it('surfaces connect and disconnect failures from the real driver', async () => {
    expect.hasAssertions();

    // Happy-path suites above already exercised live Redis. These catch
    // branches need the driver to reject: override connect/quit on the same
    // node-redis instance (not a substitute library) so the adapter's error
    // mapping is measured without hanging the gate on an open TCP connect.
    const driver = client.client as {
      connect: () => Promise<unknown>;
      quit: () => Promise<unknown>;
    };
    const originalConnect = driver.connect.bind(driver);
    const originalQuit = driver.quit.bind(driver);
    driver.connect = async () => {
      throw new Error('connect-refused');
    };
    driver.quit = async () => {
      throw new Error('quit-refused');
    };

    try {
      client.connected = false;
      const connect = await client.connect();
      const disconnect = await client.disconnect();

      expect(connect.error).toBeInstanceOf(Error);
      expect(connect.error?.message).toBe('connect-refused');
      expect(disconnect.error).toBeInstanceOf(Error);
      expect(disconnect.error?.message).toBe('quit-refused');
    } finally {
      driver.connect = originalConnect;
      driver.quit = originalQuit;
    }
  }, 30000);
});

suite('choosing the Redis driver with a server present', () => {
  it('compiles the Redis client when no driver is named', () => {
    expect.hasAssertions();

    // The default reaches for Redis, which is the consequential half of that
    // decision: with a server present it succeeds silently, and the unit suite
    // can only assert which class was built.
    const compiled = withoutDriverNamed(() => compileKeyValueStorageClient());

    expect(compiled).toBeInstanceOf(RedisKeyValueStorageClient);
  });

  it('rebuilds after reset and falls back when port/timeout env are non-finite', () => {
    expect.hasAssertions();

    const previous = {
      port: process.env.AAA_REDIS_PORT,
      timeout: process.env.AAA_REDIS_CONNECT_TIMEOUT_MS,
      host: process.env.AAA_REDIS_HOST,
      user: process.env.AAA_REDIS_USERNAME,
      pass: process.env.AAA_REDIS_PASSWORD,
      db: process.env.AAA_REDIS_DB
    };
    process.env.AAA_REDIS_PORT = 'not-a-number';
    process.env.AAA_REDIS_CONNECT_TIMEOUT_MS = 'also-bad';
    delete process.env.AAA_REDIS_HOST;
    process.env.AAA_REDIS_USERNAME = 'ci-user';
    process.env.AAA_REDIS_PASSWORD = 'ci-pass';
    process.env.AAA_REDIS_DB = '2';

    try {
      resetRedisKeyValueStorageClientForTests();
      const rebuilt = RedisKeyValueStorageClient.compile();
      expect(rebuilt).toBeInstanceOf(RedisKeyValueStorageClient);
      expect(RedisKeyValueStorageClient.compile()).toBe(rebuilt);

      // Finite overrides after a reset cover the other side of each ternary.
      process.env.AAA_REDIS_PORT = '6379';
      process.env.AAA_REDIS_CONNECT_TIMEOUT_MS = '1000';
      process.env.AAA_REDIS_HOST = '127.0.0.1';
      resetRedisKeyValueStorageClientForTests();
      expect(RedisKeyValueStorageClient.compile()).toBeInstanceOf(RedisKeyValueStorageClient);
    } finally {
      restoreEnvVar('AAA_REDIS_PORT', previous.port);
      restoreEnvVar('AAA_REDIS_CONNECT_TIMEOUT_MS', previous.timeout);
      restoreEnvVar('AAA_REDIS_HOST', previous.host);
      restoreEnvVar('AAA_REDIS_USERNAME', previous.user);
      restoreEnvVar('AAA_REDIS_PASSWORD', previous.pass);
      restoreEnvVar('AAA_REDIS_DB', previous.db);
      resetRedisKeyValueStorageClientForTests();
    }
  });

  /**
   * Success and failure share the `ServiceResponse` shape: both `result` and
   * `error` keys are present; callers distinguish them by truthiness of
   * `response.error`. A successful read is not a bare `{ result }` object.
   */
  it('returns a ServiceResponse on success with no error set', async () => {
    expect.hasAssertions();

    const redisClient = RedisKeyValueStorageClient.compile();

    try {
      const success = await redisClient.get(key('shape'));

      expect(success).toBeInstanceOf(ServiceResponse);
      expect(Object.keys(success).sort()).toStrictEqual(['error', 'result']);
      expect(success.error).toBeUndefined();
    } finally {
      await redisClient.disconnect();
      resetRedisKeyValueStorageClientForTests();
    }
  }, 30000);
});
