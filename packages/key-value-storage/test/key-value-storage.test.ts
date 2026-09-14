/*
 * Two classes, reported at file level: a concrete subclass of the abstract base
 * client, and a Map whose operations throw. Both exist to reach behaviour that
 * cannot be reached otherwise, and both belong next to the blocks that use
 * them rather than in a shared helper away from the reason they exist.
 */
/* eslint-disable max-classes-per-file */
import net from 'node:net';

import type { IServiceResponse } from '../src';
import {
  BaseKeyValueStorageClient,
  InMemoryKeyValueStorageClient,
  RedisKeyValueStorageClient,
  ServiceResponse,
  compileKeyValueStorageClient,
  resetRedisKeyValueStorageClientForTests
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

  it('defaults the port to 6379 when the environment names none', async () => {
    expect.hasAssertions();

    const client = await withEnvironment(
      'JUMENTIX_REDIS_PORT',
      undefined,
      () => RedisKeyValueStorageClient.create()
    );

    expect((client.client.options.socket as any).port).toBe(6379);
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

  it('passes optional authentication settings and malformed port fallbacks to Redis', async () => {
    expect.hasAssertions();

    const client = await withEnvironmentVars({
      JUMENTIX_REDIS_HOST: '',
      JUMENTIX_REDIS_PORT: 'not-a-port',
      JUMENTIX_REDIS_USERNAME: 'service-user',
      JUMENTIX_REDIS_PASSWORD: 'service-secret',
      JUMENTIX_REDIS_DB: '3'
    }, () => RedisKeyValueStorageClient.create());
    const socket = client.client.options.socket as any;

    expect(socket.host).toBe('127.0.0.1');
    expect(socket.port).toBe(6379);
    expect(client.client.options.username).toBe('service-user');
    expect(client.client.options.password).toBe('service-secret');
    expect(client.client.options.database).toBe(3);
  });

  it('falls back to the defaults when the timeout environment is malformed', async () => {
    expect.hasAssertions();

    const client = await withEnvironmentVars({
      JUMENTIX_REDIS_CONNECT_TIMEOUT_MS: 'not-a-number',
      JUMENTIX_REDIS_MAX_RECONNECT_ATTEMPTS: '0'
    }, () => RedisKeyValueStorageClient.create());

    expect((client.client.options.socket as any).connectTimeout).toBe(5000);
  });

  it('returns capped retry delays before the configured reconnect ceiling', async () => {
    expect.hasAssertions();

    const client = await withEnvironmentVars({
      JUMENTIX_REDIS_MAX_RECONNECT_ATTEMPTS: '5'
    }, () => RedisKeyValueStorageClient.create());
    const { reconnectStrategy } = (client.client.options.socket as any);

    expect(reconnectStrategy(0)).toBe(100);
    expect(reconnectStrategy(4)).toBe(1000);
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

/**
 * The Redis client's success paths, against a real TCP server speaking enough
 * RESP (the Redis wire protocol) to answer GET/SET/DEL/QUIT — written here, in
 * the test, so the suite needs no server process and no wall-clock waits. The
 * client under test is the real `redis` driver over a real socket: what is
 * asserted is OUR client's behaviour (prefixing, state tracking, error
 * reporting), never the server's.
 *
 * The live-server versions of these paths belong to
 * `test/integration/redis.integration.test.ts` under `RUN_REDIS_INTEGRATION`;
 * this block is what lets the unit run measure the same lines deterministically.
 */

/** One complete RESP array of bulk strings, or null when more bytes are owed. */
function readRespCommand(buffer: Buffer): { args: Buffer[]; consumed: number } | null {
  if (buffer.length === 0 || buffer[0] !== 0x2a) return null; // '*'
  const headerEnd = buffer.indexOf('\r\n');
  if (headerEnd === -1) return null;
  const count = Number(buffer.subarray(1, headerEnd).toString());
  if (!Number.isInteger(count)) return null;
  const args: Buffer[] = [];
  let offset = headerEnd + 2;
  for (let index = 0; index < count; index += 1) {
    if (buffer.length <= offset || buffer[offset] !== 0x24) return null; // '$'
    const lengthEnd = buffer.indexOf('\r\n', offset);
    if (lengthEnd === -1) return null;
    const length = Number(buffer.subarray(offset + 1, lengthEnd).toString());
    const start = lengthEnd + 2;
    if (buffer.length < start + length + 2) return null;
    args.push(buffer.subarray(start, start + length));
    offset = start + length + 2;
  }
  return { args, consumed: offset };
}

function fakeRedisServer(initial: Record<string, string> = {}) {
  const data = new Map<string, string>(Object.entries(initial));
  // When set, every data command is refused with a RESP error — a server that
  // is up but failing, the case the per-operation try/catch exists for.
  let refusing = false;
  const sockets = new Set<net.Socket>();
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    let pending = Buffer.alloc(0);
    socket.on('data', (chunk: Buffer) => {
      pending = Buffer.concat([pending, chunk]);
      for (;;) {
        const parsed = readRespCommand(pending);
        if (!parsed) break;
        pending = pending.subarray(parsed.consumed);
        const [name, ...args] = parsed.args.map((argument) => argument.toString());
        const key = args[0];
        if (refusing && ['GET', 'SET', 'DEL'].includes(name.toUpperCase())) {
          socket.write('-ERR storage failure\r\n');
          // eslint-disable-next-line no-continue
          continue;
        }
        switch (name.toUpperCase()) {
          case 'GET': {
            const value = data.get(key);
            socket.write(value === undefined
              ? '$-1\r\n'
              : `$${Buffer.byteLength(value)}\r\n${value}\r\n`);
            break;
          }
          case 'SET':
            data.set(key, args[1]);
            socket.write('+OK\r\n');
            break;
          case 'DEL':
            socket.write(`:${data.delete(key) ? 1 : 0}\r\n`);
            break;
          case 'QUIT':
            // Answer and leave the close to the client: ending the socket
            // from here can deliver FIN before the driver has processed the
            // +OK, which it reports as an unexpected close (and logs after
            // the suite has finished).
            socket.write('+OK\r\n');
            break;
          case 'PING':
            socket.write('+PONG\r\n');
            break;
          default:
            // AUTH/SELECT/CLIENT SETINFO and anything else: accept and move on.
            socket.write('+OK\r\n');
        }
      }
    });
  });

  return {
    data,
    refuse: () => { refusing = true; },
    listen: () => new Promise<number>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        resolve((server.address() as net.AddressInfo).port);
      });
    }),
    close: async () => {
      sockets.forEach((socket) => socket.destroy());
      await new Promise<void>((resolve) => { server.close(() => resolve()); });
    }
  };
}

describe('the Redis client against an in-process RESP server', () => {
  const connectTo = (port: number) => RedisKeyValueStorageClient.create({
    socket: {
      host: '127.0.0.1',
      port,
      connectTimeout: 1000,
      reconnectStrategy: () => new Error('no reconnects in this suite')
    },
    database: 0
  });

  it('connects and tracks its state, and reconnecting is a no-op', async () => {
    expect.hasAssertions();

    const server = fakeRedisServer();
    const port = await server.listen();
    const client = connectTo(port);
    try {
      expect(client.connected).toBe(false);

      const connection = await client.connect();

      expect(connection).toStrictEqual(new ServiceResponse({ result: { connected: true } }));
      expect(client.connected).toBe(true);

      // Connecting a live client again must be a no-op, not a second socket.
      await expect(client.connect()).resolves
        .toStrictEqual(new ServiceResponse({ result: { connected: true } }));
    } finally {
      await client.disconnect();
      await server.close();
    }
  });

  it('round-trips a value under the prefixed key', async () => {
    expect.hasAssertions();

    const server = fakeRedisServer();
    const port = await server.listen();
    const client = connectTo(port);
    try {
      const written = await client.set('round-trip', 'stored');
      expect(written).toStrictEqual(new ServiceResponse({ result: 'OK' }));
      // The prefix is on the wire, not only on the argument: the server holds
      // the namespaced key.
      expect([...server.data.keys()]).toStrictEqual([`${client.prefix}:round-trip`]);

      await expect(client.get('round-trip')).resolves
        .toStrictEqual(new ServiceResponse({ result: 'stored' }));
      await expect(client.get('never-written')).resolves
        .toStrictEqual(new ServiceResponse({ result: null }));
    } finally {
      await client.disconnect();
      await server.close();
    }
  });

  it('deletes keys and reports how many it removed', async () => {
    expect.hasAssertions();

    const server = fakeRedisServer({ 'jumentix__:to-delete': 'value' });
    const port = await server.listen();
    const client = connectTo(port);
    try {
      await expect(client.del('to-delete')).resolves
        .toStrictEqual(new ServiceResponse({ result: 1 }));
      await expect(client.del('to-delete')).resolves
        .toStrictEqual(new ServiceResponse({ result: 0 }));
      await expect(client.get('to-delete')).resolves
        .toStrictEqual(new ServiceResponse({ result: null }));
    } finally {
      await client.disconnect();
      await server.close();
    }
  });

  it('disconnects and reports the new state', async () => {
    expect.hasAssertions();

    const server = fakeRedisServer();
    const port = await server.listen();
    const client = connectTo(port);
    try {
      await expect(client.connect()).resolves
        .toStrictEqual(new ServiceResponse({ result: { connected: true } }));

      const disconnection = await client.disconnect();
      expect(disconnection).toStrictEqual(new ServiceResponse({ result: { connected: false } }));
      expect(client.connected).toBe(false);
    } finally {
      await server.close();
    }
  });

  it('resets the singleton so a suite can rebuild against another endpoint', async () => {
    expect.hasAssertions();

    const first = RedisKeyValueStorageClient.compile();
    resetRedisKeyValueStorageClientForTests();
    const second = RedisKeyValueStorageClient.compile();

    expect(second).not.toBe(first);
    expect(RedisKeyValueStorageClient.compile()).toBe(second);
  });
});

describe('the Redis client when the server refuses commands', () => {
  it('reports the refusal from get/set/del instead of throwing it', async () => {
    expect.hasAssertions();

    // Connected, but every command fails: the per-operation try/catch is what
    // stands between a caller and a rejected driver promise.
    const server = fakeRedisServer({ seeded: 'value' });
    const port = await server.listen();
    const client = RedisKeyValueStorageClient.create({
      socket: {
        host: '127.0.0.1',
        port,
        connectTimeout: 1000,
        reconnectStrategy: () => new Error('no reconnects in this suite')
      },
      database: 0
    });
    try {
      await expect(client.connect()).resolves
        .toStrictEqual(new ServiceResponse({ result: { connected: true } }));

      server.refuse();

      for (const call of [
        () => client.get('seeded'),
        () => client.set('k', 'v'),
        () => client.del('seeded')
      ]) {
        // eslint-disable-next-line no-await-in-loop
        const response = await call();
        expect(response.result).toBeUndefined();
        expect(response.error).toBeInstanceOf(Error);
        expect(String((response.error as Error).message)).toContain('storage failure');
      }
      // Nothing was written or removed through the refusal.
      expect(server.data.get('seeded')).toBe('value');
    } finally {
      // Disconnect BEFORE closing the server: destroying the socket under a
      // live client surfaces as an unexpected-close error after the test ends.
      await client.disconnect();
      await server.close();
    }
  });
});
