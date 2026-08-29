import {
  DeadLetterQueue,
  InMemoryDeadLetterStore,
  KeyValueDeadLetterStore,
  type DeadLetterRecord
} from '../src';

/** A key-value client with the surface the Redis one exposes: get/set/del only. */
function fakeKeyValueClient() {
  const values = new Map<string, string>();
  return {
    values,
    async get(key: string) { return { result: values.get(key) }; },
    async set(key: string, value: unknown) { values.set(key, String(value)); return { result: 'OK' }; },
    async del(key: string) { values.delete(key); return { result: 1 }; }
  };
}

function lockedUserUpdate(queue: DeadLetterQueue, id = 'user-1') {
  return queue.enqueue({
    entityName: 'User',
    resourceId: id,
    operation: 'update',
    payload: { firstName: 'Ada' },
    actorId: 'actor-1'
  });
}

describe('deadLetterQueue (JUM-53)', () => {
  it('captures enough of the rejected write to replay it without the request', async () => {
    expect.hasAssertions();

    const queue = new DeadLetterQueue();
    const record = await lockedUserUpdate(queue);

    expect(record).toMatchObject({
      entityName: 'User',
      resourceId: 'user-1',
      operation: 'update',
      payload: { firstName: 'Ada' },
      actorId: 'actor-1',
      attempts: 0,
      status: 'pending'
    });
    expect(record.id).toBeTruthy();
  });

  it('replays through the handler and proves the write by its effect', async () => {
    expect.hasAssertions();

    // The assertion that matters is the row, not the drain. A queue that
    // empties without performing the write is the failure being guarded here.
    const table = new Map<string, { firstName: string }>();
    const queue = new DeadLetterQueue();
    await lockedUserUpdate(queue);

    const report = await queue.replay({
      update: async (record) => {
        table.set(record.resourceId, record.payload as { firstName: string });
      }
    });

    expect(report.replayed).toHaveLength(1);
    expect(table.get('user-1')).toStrictEqual({ firstName: 'Ada' });
    await expect(queue.pending()).resolves.toStrictEqual([]);
  });

  it('keeps a record replayable while the lock still holds', async () => {
    expect.hasAssertions();

    const queue = new DeadLetterQueue({ maxAttempts: 3 });
    await lockedUserUpdate(queue);

    const report = await queue.replay({
      update: async () => { throw new Error('User user-1 is locked'); }
    });

    expect(report.retried).toHaveLength(1);
    const [pending] = await queue.pending();

    expect(pending.attempts).toBe(1);
    expect(pending.lastError).toBe('User user-1 is locked');
  });

  it('abandons a record whose lock never clears, and never picks it again', async () => {
    expect.hasAssertions();

    const queue = new DeadLetterQueue({ maxAttempts: 2 });
    await lockedUserUpdate(queue);
    const alwaysLocked = { update: async () => { throw new Error('still locked'); } };

    await queue.replay(alwaysLocked);
    const second = await queue.replay(alwaysLocked);

    expect(second.abandoned).toHaveLength(1);
    await expect(queue.pending()).resolves.toStrictEqual([]);

    // The bound is the point: without it a permanently locked resource is
    // retried for ever, turning one stuck write into permanent load.
    let calls = 0;
    const third = await queue.replay({ update: async () => { calls += 1; } });

    expect(calls).toBe(0);
    expect(third.replayed).toStrictEqual([]);
  });

  it('skips an unregistered operation instead of discarding the write', async () => {
    expect.hasAssertions();

    const queue = new DeadLetterQueue();
    await queue.enqueue({
      entityName: 'User', resourceId: 'user-2', operation: 'deletePhone', payload: {}
    });

    const report = await queue.replay({ update: async () => undefined });

    // A missing handler is a wiring mistake in this process. Abandoning the
    // record for it would lose exactly the data the queue exists to keep.
    expect(report.skipped).toHaveLength(1);
    await expect(queue.pending()).resolves.toHaveLength(1);
  });

  it('replays records in the order they were rejected', async () => {
    expect.hasAssertions();

    // Two rejected writes to one resource: replaying them out of order lets
    // the earlier value win, which is a silent data loss.
    const queue = new DeadLetterQueue();
    await queue.enqueue({
      entityName: 'User', resourceId: 'user-1', operation: 'update', payload: { firstName: 'first' }
    });
    await queue.enqueue({
      entityName: 'User', resourceId: 'user-1', operation: 'update', payload: { firstName: 'second' }
    });

    const applied: string[] = [];
    await queue.replay({
      update: async (record) => {
        applied.push((record.payload as { firstName: string }).firstName);
      }
    });

    expect(applied).toStrictEqual(['first', 'second']);
  });

  it('refuses an enqueue that could not be replayed', async () => {
    expect.hasAssertions();

    const queue = new DeadLetterQueue();

    await expect(queue.enqueue({
      entityName: '', resourceId: 'user-1', operation: 'update', payload: {}
    })).rejects.toThrow('entityName');
    await expect(queue.enqueue({
      entityName: 'User', resourceId: '', operation: 'update', payload: {}
    })).rejects.toThrow('resourceId');
    await expect(queue.enqueue({
      entityName: 'User', resourceId: 'user-1', operation: '', payload: {}
    })).rejects.toThrow('operation');
  });

  it('rejects a queue configured never to attempt anything', async () => {
    expect.hasAssertions();

    expect(() => new DeadLetterQueue({ maxAttempts: 0 })).toThrow('maxAttempts');
  });

  it('does not let a caller mutate a stored record through its reference', async () => {
    expect.hasAssertions();

    const store = new InMemoryDeadLetterStore();
    const queue = new DeadLetterQueue({ store });
    const record = await lockedUserUpdate(queue);
    record.status = 'succeeded';

    const stored = await queue.find(record.id);

    expect(stored?.status).toBe('pending');
  });
});

describe('keyValueDeadLetterStore (JUM-53)', () => {
  it('survives a client that only offers get, set and del', async () => {
    expect.hasAssertions();

    // The Redis client the mutex uses has no SCAN and no KEYS, which is why
    // the store keeps its own index instead of enumerating a key space.
    const client = fakeKeyValueClient();
    const queue = new DeadLetterQueue({ store: new KeyValueDeadLetterStore(client) });
    await lockedUserUpdate(queue);
    await queue.enqueue({
      entityName: 'User', resourceId: 'user-2', operation: 'delete', payload: {}
    });

    const pending = await queue.pending();

    expect(pending.map((record: DeadLetterRecord) => record.resourceId))
      .toStrictEqual(['user-1', 'user-2']);
    expect([...client.values.keys()]).toContain('dlq:index');
  });

  it('reads back a record written by another process', async () => {
    expect.hasAssertions();

    const client = fakeKeyValueClient();
    const writer = new DeadLetterQueue({ store: new KeyValueDeadLetterStore(client) });
    const record = await lockedUserUpdate(writer);

    // A second queue over the same client is what a replay worker in another
    // process actually is.
    const worker = new DeadLetterQueue({ store: new KeyValueDeadLetterStore(client) });
    const seen = await worker.find(record.id);

    expect(seen).toMatchObject({ resourceId: 'user-1', operation: 'update' });
  });

  it('surfaces a store failure instead of losing the record quietly', async () => {
    expect.hasAssertions();

    const failing = {
      async get() { return { result: undefined }; },
      async set() { return { error: new Error('redis unreachable') }; },
      async del() { return { result: 1 }; }
    };
    const queue = new DeadLetterQueue({ store: new KeyValueDeadLetterStore(failing) });

    await expect(lockedUserUpdate(queue)).rejects.toThrow('redis unreachable');
  });

  it('ignores an index that is not readable rather than crashing the drain', async () => {
    expect.hasAssertions();

    const client = fakeKeyValueClient();
    client.values.set('dlq:index', 'not json');
    const queue = new DeadLetterQueue({ store: new KeyValueDeadLetterStore(client) });

    await expect(queue.pending()).resolves.toStrictEqual([]);
  });

  it('requires a client', () => {
    expect.hasAssertions();

    expect(() => new KeyValueDeadLetterStore(undefined as never)).toThrow('key-value client');
  });
});

/**
 * What the store does when the client refuses (JUM-721).
 *
 * The suites above drive the store against a client that always succeeds, so
 * the four `if (error) throw error` guards and the "already indexed" short
 * circuit have never run. Every one of them decides whether a dead letter is
 * lost silently:
 *
 * - a failed read that returned `[]` instead of throwing would report an empty
 *   queue for a store that is merely unreachable, and the operator would
 *   conclude there is nothing to replay;
 * - a failed write that returned normally would drop the record the queue
 *   exists to keep;
 * - an index that appends the same id twice replays that record twice, which
 *   for a non-idempotent write is a second charge, a second email, a second
 *   anything.
 *
 * The client is a **double** of the Redis key-value port (Requirement 135 §5):
 * these are the refusals a real Redis produces and cannot be asked for.
 */
describe('keyValueDeadLetterStore refusals (JUM-721)', () => {
  const record = (id: string): DeadLetterRecord => ({
    id,
    entityName: 'User',
    resourceId: 'user-1',
    operation: 'update',
    payload: { firstName: 'Ada' },
    actorId: 'actor-1',
    attempts: 0,
    status: 'pending',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  } as DeadLetterRecord);

  /** A client whose named operation answers with an error rather than a result. */
  const failingOn = (operation: 'get' | 'set') => {
    const client = fakeKeyValueClient();
    return {
      ...client,
      get: async (key: string) => (
        operation === 'get' ? { error: new Error('store unreachable') } : client.get(key)
      ),
      set: async (key: string, value: unknown) => (
        operation === 'set' ? { error: new Error('store read-only') } : client.set(key, value)
      )
    };
  };

  it('raises a failed read instead of reporting an empty queue', async () => {
    expect.hasAssertions();

    const store = new KeyValueDeadLetterStore(failingOn('get') as never);

    await expect(store.list()).rejects.toThrow('store unreachable');
    await expect(store.get('dlq-1')).rejects.toThrow('store unreachable');
  });

  it('raises a failed write instead of dropping the record', async () => {
    expect.hasAssertions();

    const store = new KeyValueDeadLetterStore(failingOn('set') as never);

    await expect(store.put(record('dlq-1'))).rejects.toThrow('store read-only');
  });

  it('raises when the index write fails after the record was stored', async () => {
    expect.hasAssertions();

    // The record landed and the index did not: the entry exists and nothing
    // lists it. Reporting success here is how a dead letter becomes invisible.
    const client = fakeKeyValueClient();
    const behaviours: Array<(key: string, value: unknown) => Promise<unknown>> = [
      client.set,
      async () => ({ error: new Error('index write refused') })
    ];
    const failingIndexWrite = {
      ...client,
      set: async (key: string, value: unknown) => {
        const [behaviour = client.set] = behaviours.splice(0, 1);
        return behaviour(key, value);
      }
    };

    const store = new KeyValueDeadLetterStore(failingIndexWrite as never);

    await expect(store.put(record('dlq-1'))).rejects.toThrow('index write refused');
  });

  it('indexes an id once, however many times it is put', async () => {
    expect.hasAssertions();

    // A replay worker re-puts a record on every attempt. A second index entry
    // means the record is listed twice and replayed twice.
    const client = fakeKeyValueClient();
    const store = new KeyValueDeadLetterStore(client as never);

    await store.put(record('dlq-1'));
    await store.put(record('dlq-1'));

    await expect(store.list()).resolves.toHaveLength(1);
  });

  it('reads an absent or empty value as nothing rather than as a record', async () => {
    expect.hasAssertions();

    // Redis answers a missing key with null and a cleared one with the empty
    // string; `JSON.parse` on either throws, and a store that let that escape
    // would fail a list because one entry had been deleted.
    const client = fakeKeyValueClient();
    client.values.set('dlq:index', JSON.stringify(['dlq-1', 'dlq-2']));
    client.values.set('dlq:record:dlq-1', '');
    const store = new KeyValueDeadLetterStore(client as never);

    await expect(store.get('dlq-missing')).resolves.toBeUndefined();
    await expect(store.get('dlq-1')).resolves.toBeUndefined();
    await expect(store.list()).resolves.toStrictEqual([]);
  });
});
