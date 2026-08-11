import {
  RedisKeyValueStorageClient,
  resetRedisKeyValueStorageClientForTests
} from '@jumentix/key-value-storage';
import {
  DeadLetterQueue,
  DeadLetterReplayWorker,
  KeyValueDeadLetterStore
} from '../../src';

/**
 * The queue against a real Redis (JUM-53, Requirement 115).
 *
 * The unit suite exercises `KeyValueDeadLetterStore` against a double with the
 * same narrow surface. That proves the store's logic and nothing about Redis:
 * values come back as strings, keys survive across connections, and a second
 * process sees what the first wrote. Those are the properties the whole design
 * rests on, and only a real server can answer them.
 */

const RUNNING = process.env.RUN_REDIS_INTEGRATION === '1';

/**
 * Skipped rather than passed when the server is absent.
 *
 * A suite that reports success without its dependency is the false green this
 * repository keeps finding.
 */
const suite = RUNNING ? describe : describe.skip;

/** A prefix per run, so a leftover key from an earlier run cannot make this green. */
const prefix = `dlq-it-${Date.now()}`;

suite('deadLetterQueue against a real Redis (JUM-53)', () => {
  let client: RedisKeyValueStorageClient;

  beforeAll(async () => {
    client = RedisKeyValueStorageClient.compile();
    await client.connect();
  });

  afterAll(async () => {
    const live = RedisKeyValueStorageClient.compile();
    if (live.connected) await live.disconnect();
    resetRedisKeyValueStorageClientForTests();
  });

  it('round-trips a record through Redis, string encoding and all', async () => {
    expect.hasAssertions();

    const queue = new DeadLetterQueue({
      store: new KeyValueDeadLetterStore(client as never, { prefix: `${prefix}:roundtrip` })
    });

    const written = await queue.enqueue({
      entityName: 'User',
      resourceId: 'user-1',
      operation: 'update',
      payload: { firstName: 'Ada', nested: { deep: [1, 2, 3] } },
      actorId: 'actor-1'
    });
    const read = await queue.find(written.id);

    // Redis returns strings. A store that only ever saw an object double would
    // pass its unit tests and return `undefined` here.
    expect(read).toStrictEqual(written as never);
    expect(read?.payload).toStrictEqual({ firstName: 'Ada', nested: { deep: [1, 2, 3] } });
  });

  it('is visible to a second queue over the same server', async () => {
    expect.hasAssertions();

    // What a replay worker in another process actually is.
    const scope = `${prefix}:shared`;
    const writer = new DeadLetterQueue({
      store: new KeyValueDeadLetterStore(client as never, { prefix: scope })
    });
    await writer.enqueue({
      entityName: 'User', resourceId: 'user-2', operation: 'delete', payload: {}
    });

    const worker = new DeadLetterQueue({
      store: new KeyValueDeadLetterStore(client as never, { prefix: scope })
    });
    const pending = await worker.pending();

    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ resourceId: 'user-2', operation: 'delete' });
  });

  it('keeps rejection order across the index', async () => {
    expect.hasAssertions();

    // The index exists because this client has no SCAN. If it did not hold
    // order, two writes to one resource would replay in the wrong sequence and
    // the earlier value would win, silently.
    const queue = new DeadLetterQueue({
      store: new KeyValueDeadLetterStore(client as never, { prefix: `${prefix}:order` })
    });
    for (const firstName of ['first', 'second', 'third']) {
      // Sequential on purpose: the point of the assertion is the order in
      // which they were enqueued.
      // eslint-disable-next-line no-await-in-loop
      await queue.enqueue({
        entityName: 'User', resourceId: 'user-3', operation: 'update', payload: { firstName }
      });
    }

    const applied: string[] = [];
    await queue.replay({
      update: async (record) => {
        applied.push((record.payload as { firstName: string }).firstName);
      }
    });

    expect(applied).toStrictEqual(['first', 'second', 'third']);
  });

  it('drains through the worker and leaves nothing pending', async () => {
    expect.hasAssertions();

    const queue = new DeadLetterQueue({
      store: new KeyValueDeadLetterStore(client as never, { prefix: `${prefix}:worker` })
    });
    await queue.enqueue({
      entityName: 'User', resourceId: 'user-4', operation: 'update', payload: { firstName: 'Ada' }
    });
    const applied: string[] = [];
    const worker = new DeadLetterReplayWorker({
      queue,
      handlers: { update: async (record) => { applied.push(record.resourceId); } }
    });

    const report = await worker.tick();

    expect(report?.replayed).toHaveLength(1);
    expect(applied).toStrictEqual(['user-4']);
    await expect(queue.pending()).resolves.toStrictEqual([]);
  });

  it('abandons a record whose lock never clears, and persists that decision', async () => {
    expect.hasAssertions();

    // The terminal state has to survive the round trip, or a restart would
    // resurrect a record that was deliberately given up on.
    const store = new KeyValueDeadLetterStore(client as never, { prefix: `${prefix}:abandon` });
    const queue = new DeadLetterQueue({ store, maxAttempts: 2 });
    const record = await queue.enqueue({
      entityName: 'User', resourceId: 'user-5', operation: 'update', payload: {}
    });
    const alwaysLocked = { update: async () => { throw new Error('still locked'); } };

    await queue.replay(alwaysLocked);
    await queue.replay(alwaysLocked);

    const reopened = new DeadLetterQueue({
      store: new KeyValueDeadLetterStore(client as never, { prefix: `${prefix}:abandon` })
    });
    const seen = await reopened.find(record.id);

    expect(seen).toMatchObject({ status: 'abandoned', attempts: 2, lastError: 'still locked' });
    await expect(reopened.pending()).resolves.toStrictEqual([]);
  });
});
