import {
  RedisKeyValueStorageClient,
  ServiceResponse,
  compileKeyValueStorageClient
} from '../../src';

/**
 * The Redis client against a real Redis (Requirement 112 §1).
 *
 * The unit suite deliberately stops at the singleton and the initial state, and
 * says why: without a server, `connect()` does not fail — it waits, because the
 * client sets no connect timeout and the driver retries without a ceiling. So
 * everything this adapter actually does was untested, and the file carried
 * `istanbul ignore file` to say so honestly rather than to hide it.
 *
 * This closes that. It runs against the container in
 * `apps/backend-template/docker-compose-redis.yml`, under
 * `RUN_REDIS_INTEGRATION`, and it is a real server: real keys, real round
 * trips, real disconnection.
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

    expect(response).toStrictEqual({ result: { connected: true } });
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

  /**
   * Records an inconsistency rather than a guarantee.
   *
   * A successful read returns a plain `{ result }` with no `error` key at all,
   * while a failure returns a `ServiceResponse`, which has both. So the shape a
   * caller receives depends on the outcome, and `'error' in response` answers
   * differently for the same operation depending on whether it worked.
   *
   * Every caller in this repository checks `response.error` for truthiness, so
   * nothing is broken today. It is pinned because making the two agree is a
   * one-line change that would otherwise happen silently, and because a reader
   * comparing this adapter to the in-memory one will notice the difference and
   * deserve to find it written down.
   */
  it('returns a bare result on success and a ServiceResponse on failure', async () => {
    expect.hasAssertions();

    const client = RedisKeyValueStorageClient.compile();
    const success = await client.get(key('shape'));

    expect(Object.keys(success)).toStrictEqual(['result']);
    expect(success.error).toBeUndefined();

    // The failure shape, for comparison: both fields present.
    expect(Object.keys(new ServiceResponse({ error: new Error('x') })).sort())
      .toStrictEqual(['error', 'result']);
  }, 30000);
});
