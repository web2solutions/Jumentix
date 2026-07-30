import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import type { CanaSchema } from '@jumentix/cana';
import {
  StorageDurability,
  browserStorageEnvironment,
  canaError,
  classifyOpen,
  closeDatabase,
  createClient,
  createRouter,
  deleteDatabase,
  isCanaError,
  isCanaErrorCode,
  keyStrategyOf,
  openDatabase,
  planQuery,
  toKeyRange,
  translateError,
  validateSchema
} from '@jumentix/cana';

/**
 * The paths the happy-path suites do not reach: failure branches, boundary
 * values, and the environment-dependent code that only runs when something is
 * missing.
 *
 * These are the branches most likely to be wrong, precisely because they are the
 * ones nobody exercises by hand.
 */

interface Design { id: number; name: string; size?: number }

const schema = (over: Partial<CanaSchema> = {}): CanaSchema => ({
  version: 1,
  stores: [{ name: 'designs', keyPath: 'id' }],
  ...over
});

/** A localStorage-shaped tombstone, defined once so no test body branches. */
function memoryTombstone() {
  const backing = new Map<string, string>();
  return {
    backing,
    tombstone: {
      get: (key: string) => (backing.has(key) ? (backing.get(key) as string) : null),
      set: (key: string, value: string) => { backing.set(key, value); },
      remove: (key: string) => { backing.delete(key); }
    }
  };
}

describe('error translation edge cases', () => {
  it('flattens a cause with only a name', () => {
    expect.hasAssertions();
    const failure = translateError({ name: 'QuotaExceededError' });

    expect(failure.code).toBe('QuotaExceeded');
    expect(failure.cause).toBe('QuotaExceededError');
  });

  it('flattens a cause with only a message', () => {
    expect.hasAssertions();
    const failure = translateError({ message: 'something went wrong' });

    expect(failure.code).toBe('Internal');
    expect(failure.cause).toBe('something went wrong');
  });

  it('handles a string thrown directly', () => {
    expect.hasAssertions();
    const failure = translateError('bare string failure');

    expect(failure.code).toBe('Internal');
    expect(failure.cause).toBe('bare string failure');
  });

  it('handles a primitive thrown directly', () => {
    expect.hasAssertions();
    const failure = translateError(42);

    expect(failure.code).toBe('Internal');
    expect(failure.message).toBe('Unclassified failure');
  });

  it('passes an existing CanaError through unchanged', () => {
    expect.hasAssertions();
    // Wrapping at multiple layers must not bury the original classification
    // under `Internal`.
    const original = canaError('QuotaExceeded', 'disk full');

    expect(translateError(original)).toBe(original);
  });

  it('omits cause entirely when there is nothing to report', () => {
    expect.hasAssertions();
    expect(canaError('Internal', 'no cause').cause).toBeUndefined();
    expect(canaError('Internal', 'null cause', { cause: null }).cause).toBeUndefined();
  });

  it('marks only the genuinely retryable codes as retryable', () => {
    expect.hasAssertions();
    // QuotaExceeded is deliberately absent: retrying a write that did not fit
    // will not make it fit, and marking it retryable invites a loop that burns
    // battery and never converges.
    expect(canaError('UpgradeBlocked', 'x').retryable).toBe(true);
    expect(canaError('TransactionAborted', 'x').retryable).toBe(true);
    expect(canaError('Backpressure', 'x').retryable).toBe(true);
    expect(canaError('QuotaExceeded', 'x').retryable).toBe(false);
    expect(canaError('ConstraintViolation', 'x').retryable).toBe(false);
  });

  it('narrows correctly with the guards', () => {
    expect.hasAssertions();
    const failure = canaError('NotFound', 'gone');

    expect(isCanaError(failure)).toBe(true);
    expect(isCanaError(new Error('ordinary'))).toBe(false);
    expect(isCanaError(null)).toBe(false);
    expect(isCanaErrorCode(failure, 'NotFound')).toBe(true);
    expect(isCanaErrorCode(failure, 'QuotaExceeded')).toBe(false);
  });
});

describe('schema validation edge cases', () => {
  it('rejects a store with no name', () => {
    expect.hasAssertions();
    expect(validateSchema(schema({ stores: [{ name: '', keyPath: 'id' }] })))
      .toContain('a store has no name');
  });

  it('rejects an empty schema', () => {
    expect.hasAssertions();
    expect(validateSchema(schema({ stores: [] }))).toContain('schema declares no stores');
  });

  it('rejects an empty segment inside a compound keyPath', () => {
    expect.hasAssertions();
    const problems = validateSchema(schema({
      stores: [{ name: 'designs', keyPath: ['tenantId', ''] }]
    }));

    expect(problems.some((entry) => entry.includes('empty segment'))).toBe(true);
  });

  it('rejects an empty string keyPath', () => {
    expect.hasAssertions();
    const problems = validateSchema(schema({ stores: [{ name: 'designs', keyPath: '' }] }));

    expect(problems.some((entry) => entry.includes('non-empty string'))).toBe(true);
  });

  it('rejects an index with no name', () => {
    expect.hasAssertions();
    const problems = validateSchema(schema({
      stores: [{ name: 'designs', keyPath: 'id', indexes: [{ name: '', keyPath: 'x' }] }]
    }));

    expect(problems.some((entry) => entry.includes('an index has no name'))).toBe(true);
  });

  it('rejects a non-integer version', () => {
    expect.hasAssertions();
    expect(validateSchema(schema({ version: 1.5 }))[0]).toContain('positive integer');
  });

  it('classifies every key strategy', () => {
    expect.hasAssertions();
    // The four shapes drive whether an explicit key is legal at call time.
    expect(keyStrategyOf({ name: 'a', keyPath: 'id' })).toBe('inbound');
    expect(keyStrategyOf({ name: 'a' })).toBe('outbound');
    expect(keyStrategyOf({ name: 'a', keyPath: 'id', autoIncrement: true }))
      .toBe('generated-inbound');
    expect(keyStrategyOf({ name: 'a', autoIncrement: true })).toBe('generated-outbound');
  });
});

describe('query planning edge cases', () => {
  it('builds a lower-only bound', () => {
    expect.hasAssertions();
    const range = toKeyRange({ range: { lower: 10 } });

    expect(range?.lower).toBe(10);
    expect(range?.upper).toBeUndefined();
  });

  it('builds an upper-only bound', () => {
    expect.hasAssertions();
    const range = toKeyRange({ range: { upper: 10 } });

    expect(range?.upper).toBe(10);
    expect(range?.lower).toBeUndefined();
  });

  it('returns null for an unbounded or absent query', () => {
    expect.hasAssertions();
    expect(toKeyRange(undefined)).toBeNull();
    expect(toKeyRange({})).toBeNull();
    expect(toKeyRange({ range: {} })).toBeNull();
  });

  it('prefers equals over range when both are given', () => {
    expect.hasAssertions();
    const range = toKeyRange({ equals: 5, range: { lower: 1, upper: 9 } });

    expect(range?.lower).toBe(5);
    expect(range?.upper).toBe(5);
  });

  it('reports a plan for an index with no bound as not a full scan', () => {
    expect.hasAssertions();
    // Naming an index narrows the read even without a range, so it is not the
    // degrade-with-volume case `fullScan` exists to flag.
    const plan = planQuery('designs', { index: 'byOwner' });

    expect(plan).toStrictEqual({
      store: 'designs',
      usedIndex: 'byOwner',
      fullScan: false,
      boundedByRange: false,
      appliedOffsetInCursor: false
    });
  });

  it('reports a bounded scan without an index', () => {
    expect.hasAssertions();
    const plan = planQuery('designs', { range: { lower: 1 } });

    expect(plan.fullScan).toBe(false);
    expect(plan.boundedByRange).toBe(true);
    expect(plan.usedIndex).toBeUndefined();
  });

  it('applies distinct as a unique cursor direction', async () => {
    expect.hasAssertions();
    const client = createClient({
      name: 'designer',
      factory: new IDBFactory(),
      schema: schema({
        stores: [{
          name: 'designs',
          keyPath: 'id',
          indexes: [{ name: 'bySize', keyPath: 'size' }]
        }]
      })
    });
    await client.open();
    await client.table<Design>('designs').bulkAdd([
      { id: 1, name: 'a', size: 10 },
      { id: 2, name: 'b', size: 10 },
      { id: 3, name: 'c', size: 20 }
    ]);

    const rows = await client.table<Design>('designs').query({ index: 'bySize', distinct: true });

    expect(rows).toHaveLength(2);
    await client.close();
  });

  it('counts zero on an empty store without materialising', async () => {
    expect.hasAssertions();
    const client = createClient({ name: 'designer', schema: schema(), factory: new IDBFactory() });
    await client.open();

    await expect(client.table<Design>('designs').count()).resolves.toBe(0);
    await client.close();
  });
});

describe('database lifecycle edge cases', () => {
  it('reports Unavailable when no factory and no global exist', async () => {
    expect.hasAssertions();
    // The private-browsing path. Covered here by removing the global, which is
    // the same condition the browser presents.
    const saved = Reflect.get(globalThis, 'indexedDB');
    Reflect.deleteProperty(globalThis as object, 'indexedDB');
    try {
      const failure = await openDatabase({ name: 'designer', schema: schema() })
        .catch((error: unknown) => error);

      expect(isCanaErrorCode(failure, 'Unavailable')).toBe(true);
      expect((failure as { message: string }).message).toContain('no fallback');
    } finally {
      Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: saved });
    }
  });

  it('closes a database through the exported helper', async () => {
    expect.hasAssertions();
    const factory = new IDBFactory();
    const { database } = await openDatabase({ name: 'designer', factory, schema: schema() });

    expect(() => closeDatabase(database)).not.toThrow();
  });

  it('deletes a database that exists, and one that does not', async () => {
    expect.hasAssertions();
    const factory = new IDBFactory();
    const { database } = await openDatabase({ name: 'designer', factory, schema: schema() });
    database.close();

    await expect(deleteDatabase('designer', { factory })).resolves.toBeUndefined();
    // Deleting an absent database succeeds in IndexedDB; it must not be an error.
    await expect(deleteDatabase('never-existed', { factory })).resolves.toBeUndefined();
  });

  it('reports Unavailable from deleteDatabase with no factory or global', async () => {
    expect.hasAssertions();
    const saved = Reflect.get(globalThis, 'indexedDB');
    Reflect.deleteProperty(globalThis as object, 'indexedDB');
    try {
      await expect(deleteDatabase('designer')).rejects.toMatchObject({ code: 'Unavailable' });
    } finally {
      Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: saved });
    }
  });

  it('never lets a raw DOMException escape an upgrade', async () => {
    expect.hasAssertions();
    // The boundary property, asserted unconditionally: whatever the browser does
    // inside a versionchange transaction, callers see Cana types or nothing.
    const factory = new IDBFactory();
    const first = await openDatabase({ name: 'designer', factory, schema: schema() });
    first.database.close();

    const outcome = await openDatabase({
      name: 'designer',
      factory,
      schema: schema({
        version: 2,
        stores: [{
          name: 'designs',
          keyPath: 'id',
          indexes: [{ name: 'byName', keyPath: 'name' }]
        }]
      })
    }).catch((error: unknown) => error);

    expect(outcome).not.toBeInstanceOf(Error);
    (outcome as { database?: IDBDatabase }).database?.close();
  });
});

describe('storage durability edge cases', () => {
  it('reports unknown persistence when the API is entirely absent', async () => {
    expect.hasAssertions();
    // 'unknown' rather than false: the browser refusing and the API not existing
    // are different facts, and flattening them lets an app claim a guarantee.
    const durability = new StorageDurability({});

    await expect(durability.requestPersistence()).resolves.toBe('unknown');
    await expect(durability.state()).resolves.toMatchObject({ persistent: 'unknown' });
  });

  it('returns true without asking again when already persisted', async () => {
    expect.hasAssertions();
    let persistCalls = 0;
    const durability = new StorageDurability({
      persisted: async () => true,
      persist: async () => { persistCalls += 1; return true; }
    });

    await expect(durability.requestPersistence()).resolves.toBe(true);
    expect(persistCalls).toBe(0);
  });

  it('falls back to unknown when the persistence API throws', async () => {
    expect.hasAssertions();
    const durability = new StorageDurability({
      persisted: async () => { throw new Error('blocked'); }
    });

    await expect(durability.requestPersistence()).resolves.toBe('unknown');
    await expect(durability.state()).resolves.toMatchObject({ persistent: 'unknown' });
  });

  it('reports no usage when estimate is absent or throws', async () => {
    expect.hasAssertions();
    const absent = new StorageDurability({});
    const throwing = new StorageDurability({
      estimate: async () => { throw new Error('denied'); }
    });

    await expect(absent.state()).resolves.toMatchObject({ nearQuota: false });
    await expect(throwing.state()).resolves.toMatchObject({ nearQuota: false });
  });

  it('reports nearQuota once usage crosses the ratio', async () => {
    expect.hasAssertions();
    const durability = new StorageDurability({
      estimate: async () => ({ usage: 90, quota: 100 })
    });

    await expect(durability.state()).resolves.toMatchObject({
      nearQuota: true, usageBytes: 90, quotaBytes: 100
    });
  });

  it('reports recordExistence failure rather than pretending it worked', () => {
    expect.hasAssertions();
    // Returning false is what tells the caller eviction will be undetectable.
    const noTombstone = new StorageDurability({});

    expect(noTombstone.recordExistence('designer', 1)).toBe(false);
  });

  it('survives a tombstone that throws on write', () => {
    expect.hasAssertions();
    // Private browsing throws on localStorage writes in some browsers.
    // Undetectable, not fatal.
    const durability = new StorageDurability({
      tombstone: {
        get: () => null,
        set: () => { throw new Error('private mode'); },
        remove: () => undefined
      }
    });

    expect(durability.recordExistence('designer', 1)).toBe(false);
  });

  it('treats a tombstone that throws on read as absent', () => {
    expect.hasAssertions();
    const durability = new StorageDurability({
      tombstone: {
        get: () => { throw new Error('blocked'); },
        set: () => undefined,
        remove: () => undefined
      }
    });

    const verdict = durability.evaluateOpen({
      databaseName: 'designer', foundVersion: 0, isEmpty: true
    });

    expect(verdict.reason).toBe('first-run');
  });

  it('reports undetectable when there is no tombstone at all', () => {
    expect.hasAssertions();
    const durability = new StorageDurability({});

    expect(durability.evaluateOpen({
      databaseName: 'designer', foundVersion: 0, isEmpty: true
    })).toStrictEqual({ evicted: false, reason: 'undetectable-no-tombstone' });
  });

  it('clears the eviction flag once acknowledged', async () => {
    expect.hasAssertions();
    const durability = new StorageDurability({ tombstone: memoryTombstone().tombstone });
    durability.recordExistence('designer', 1);
    durability.evaluateOpen({ databaseName: 'designer', foundVersion: 0, isEmpty: true });

    await expect(durability.state()).resolves.toMatchObject({ evicted: true });
    durability.acknowledgeEviction();

    await expect(durability.state()).resolves.toMatchObject({ evicted: false });
  });

  it('exposes the last verdict', () => {
    expect.hasAssertions();
    const durability = new StorageDurability({});

    expect(durability.lastEvictionVerdict).toBeNull();
    durability.evaluateOpen({ databaseName: 'designer', foundVersion: 0, isEmpty: true });

    expect(durability.lastEvictionVerdict).not.toBeNull();
  });

  it('reports an empty-but-present database as evicted', () => {
    expect.hasAssertions();
    // Some browsers recreate the store shell while dropping the contents.
    const verdict = classifyOpen(
      { databaseName: 'designer', foundVersion: 1, isEmpty: true },
      JSON.stringify({ version: 1, at: Date.now() })
    );

    expect(verdict).toStrictEqual({ evicted: true, reason: 'evicted-database-empty' });
  });

  it('builds an environment with no tombstone when localStorage is missing', () => {
    expect.hasAssertions();
    // The node/test case, and also a browser with storage disabled.
    expect(browserStorageEnvironment().tombstone).toBeUndefined();
  });
});

describe('table edge cases', () => {
  it('rejects a missing explicit key on an outbound store', async () => {
    expect.hasAssertions();
    const client = createClient({
      name: 'designer',
      factory: new IDBFactory(),
      schema: schema({ stores: [{ name: 'designs' }] })
    });
    await client.open();

    const failure = await client.table<Design>('designs')
      .add({ id: 1, name: 'a' })
      .catch((error: unknown) => error);

    expect(isCanaErrorCode(failure, 'InvalidRequest')).toBe(true);
    expect((failure as { message: string }).message).toContain('outbound keys');
    await client.close();
  });

  it('accepts an explicit key on an outbound store', async () => {
    expect.hasAssertions();
    const client = createClient({
      name: 'designer',
      factory: new IDBFactory(),
      schema: schema({ stores: [{ name: 'designs' }] })
    });
    await client.open();

    const written = await client.table<Design, string>('designs').put({ id: 1, name: 'a' }, 'k1');

    expect(written.key).toBe('k1');
    await expect(client.table<Design, string>('designs').get('k1'))
      .resolves.toMatchObject({ name: 'a' });
    await client.close();
  });

  it('updates through an outbound key', async () => {
    expect.hasAssertions();
    const client = createClient({
      name: 'designer',
      factory: new IDBFactory(),
      schema: schema({ stores: [{ name: 'designs' }] })
    });
    await client.open();
    const table = client.table<Design, string>('designs');
    await table.put({ id: 1, name: 'a' }, 'k1');

    await table.update('k1', { name: 'renamed' });

    await expect(table.get('k1')).resolves.toMatchObject({ name: 'renamed' });
    await client.close();
  });

  it('resolves a compound inbound key when classifying a bulk put', async () => {
    expect.hasAssertions();
    const client = createClient({
      name: 'designer',
      factory: new IDBFactory(),
      schema: schema({ stores: [{ name: 'designs', keyPath: ['tenant', 'id'] }] })
    });
    await client.open();
    type Row = { tenant: string; id: number; name: string };
    const table = client.table<Row>('designs');
    await table.add({ tenant: 't1', id: 1, name: 'first' });

    const { events } = await table.bulkPut([
      { tenant: 't1', id: 1, name: 'changed' },
      { tenant: 't1', id: 2, name: 'new' }
    ]);

    expect(events.map((event) => event.type)).toStrictEqual(['updated', 'created']);
    await client.close();
  });

  it('reports a store outside the transaction scope', async () => {
    expect.hasAssertions();
    // The most common misuse after the auto-commit one.
    const client = createClient({
      name: 'designer',
      factory: new IDBFactory(),
      schema: schema({ stores: [{ name: 'designs', keyPath: 'id' }, { name: 'notes', keyPath: 'id' }] })
    });
    await client.open();

    const failure = await client.transaction('readwrite', ['designs'], async (scope) => {
      await scope.table('notes').add({ id: 1 });
    }).catch((error: unknown) => error);

    expect(isCanaError(failure)).toBe(true);
    await client.close();
  });

  it('clears a store and reports one cleared event', async () => {
    expect.hasAssertions();
    const client = createClient({ name: 'designer', schema: schema(), factory: new IDBFactory() });
    await client.open();
    await client.table<Design>('designs').bulkAdd([{ id: 1, name: 'a' }, { id: 2, name: 'b' }]);

    const cleared = await client.table<Design>('designs').clear();

    expect(cleared.events.map((event) => event.type)).toStrictEqual(['cleared']);
    await expect(client.table<Design>('designs').count()).resolves.toBe(0);
    await client.close();
  });

  it('reports an empty bulk write as committed with no keys', async () => {
    expect.hasAssertions();
    const client = createClient({ name: 'designer', schema: schema(), factory: new IDBFactory() });
    await client.open();

    const result = await client.table<Design>('designs').bulkAdd([]);

    expect(result.outcome).toBe('committed');
    expect(result.keys).toStrictEqual([]);
    await client.close();
  });
});

describe('client edge cases', () => {
  it('is idempotent on open and on close', async () => {
    expect.hasAssertions();
    const client = createClient({ name: 'designer', schema: schema(), factory: new IDBFactory() });
    await client.open();

    await expect(client.open()).resolves.toBeUndefined();
    await client.close();
    await expect(client.close()).resolves.toBeUndefined();
  });

  it('exposes name and version from the schema', () => {
    expect.hasAssertions();
    const client = createClient({
      name: 'designer', schema: schema({ version: 7 }), factory: new IDBFactory()
    });

    expect(client.name).toBe('designer');
    expect(client.version).toBe(7);
  });

  it('tags events with the configured originId so a tab can ignore its own echo', async () => {
    expect.hasAssertions();
    const client = createClient({
      name: 'designer', schema: schema(), factory: new IDBFactory(), originId: 'tab-a'
    });
    await client.open();

    const { events } = await client.table<Design>('designs').add({ id: 1, name: 'a' });

    expect(events[0].originId).toBe('tab-a');
    await client.close();
  });

  it('replays nothing when subscribing with no history', async () => {
    expect.hasAssertions();
    const client = createClient({ name: 'designer', schema: schema(), factory: new IDBFactory() });
    await client.open();
    const seen: number[] = [];

    client.subscribe((event) => seen.push(event.cursor), { sinceCursor: 0 });

    expect(seen).toStrictEqual([]);
    await client.close();
  });

  it('refuses storageState-driven work before open for exportAll', async () => {
    expect.hasAssertions();
    const client = createClient({ name: 'designer', schema: schema(), factory: new IDBFactory() });

    await expect(client.exportAll()).rejects.toMatchObject({ code: 'InvalidRequest' });
  });

  it('reports storage state without a database being open', async () => {
    expect.hasAssertions();
    // Durability is a property of the origin, not of a connection.
    const client = createClient({ name: 'designer', schema: schema(), factory: new IDBFactory() });

    await expect(client.storageState()).resolves.toMatchObject({ evicted: false });
  });

  it('exports an empty database as empty arrays, not as a failure', async () => {
    expect.hasAssertions();
    const client = createClient({ name: 'designer', schema: schema(), factory: new IDBFactory() });
    await client.open();

    await expect(client.exportAll()).resolves.toStrictEqual({ designs: [] });
    await client.close();
  });
});

describe('router edge cases', () => {
  const inertPort = () => ({
    postMessage: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined
  });

  it('ignores a malformed message rather than throwing', () => {
    expect.hasAssertions();
    let listener: ((event: { data: unknown }) => void) | undefined;
    const router = createRouter({
      port: {
        postMessage: () => undefined,
        addEventListener: (_type, handler) => { listener = handler; },
        removeEventListener: () => undefined
      }
    });

    expect(() => listener?.({ data: null })).not.toThrow();
    expect(() => listener?.({ data: 'not an object' })).not.toThrow();
    router.dispose();
  });

  it('supplies a default error when the worker reports a failure with no detail', async () => {
    expect.hasAssertions();
    let listener: ((event: { data: unknown }) => void) | undefined;
    const sent: { requestId: string }[] = [];
    const router = createRouter({
      port: {
        postMessage: (message) => { sent.push(message as { requestId: string }); },
        addEventListener: (_type, handler) => { listener = handler; },
        removeEventListener: () => undefined
      }
    });

    const pending = router.send({ kind: 'get' });
    listener?.({ data: { requestId: sent[0].requestId, ok: false } });

    await expect(pending).rejects.toMatchObject({ code: 'Internal' });
    router.dispose();
  });

  it('reports zero pending on a fresh router', () => {
    expect.hasAssertions();
    const router = createRouter({ port: inertPort() });

    expect(router.pendingCount).toBe(0);
    router.dispose();
  });

  it('tolerates a broadcast with no handler registered', () => {
    expect.hasAssertions();
    let listener: ((event: { data: unknown }) => void) | undefined;
    const router = createRouter({
      port: {
        postMessage: () => undefined,
        addEventListener: (_type, handler) => { listener = handler; },
        removeEventListener: () => undefined
      }
    });

    expect(() => listener?.({ data: { kind: 'change', event: {} } })).not.toThrow();
    router.dispose();
  });
});
