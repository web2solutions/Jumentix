import type { CanaSchema } from '../src';
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
} from '../src';
import { rejection } from './harness';

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
    const failure = translateError({ name: 'QuotaExceededError' });

    expect(failure.code).to.equal('QuotaExceeded');
    expect(failure.cause).to.equal('QuotaExceededError');
  });

  it('flattens a cause with only a message', () => {
    const failure = translateError({ message: 'something went wrong' });

    expect(failure.code).to.equal('Internal');
    expect(failure.cause).to.equal('something went wrong');
  });

  it('handles a string thrown directly', () => {
    const failure = translateError('bare string failure');

    expect(failure.code).to.equal('Internal');
    expect(failure.cause).to.equal('bare string failure');
  });

  it('handles a primitive thrown directly', () => {
    const failure = translateError(42);

    expect(failure.code).to.equal('Internal');
    expect(failure.message).to.equal('Unclassified failure');
  });

  it('passes an existing CanaError through unchanged', () => {
    // Wrapping at multiple layers must not bury the original classification
    // under `Internal`.
    const original = canaError('QuotaExceeded', 'disk full');

    expect(translateError(original)).to.equal(original);
  });

  it('omits cause entirely when there is nothing to report', () => {
    expect(canaError('Internal', 'no cause').cause).to.equal(undefined);
    expect(canaError('Internal', 'null cause', { cause: null }).cause).to.equal(undefined);
  });

  it('marks only the genuinely retryable codes as retryable', () => {
    // QuotaExceeded is deliberately absent: retrying a write that did not fit
    // will not make it fit, and marking it retryable invites a loop that burns
    // battery and never converges.
    expect(canaError('UpgradeBlocked', 'x').retryable).to.equal(true);
    expect(canaError('TransactionAborted', 'x').retryable).to.equal(true);
    expect(canaError('Backpressure', 'x').retryable).to.equal(true);
    expect(canaError('QuotaExceeded', 'x').retryable).to.equal(false);
    expect(canaError('ConstraintViolation', 'x').retryable).to.equal(false);
  });

  it('narrows correctly with the guards', () => {
    const failure = canaError('NotFound', 'gone');

    expect(isCanaError(failure)).to.equal(true);
    expect(isCanaError(new Error('ordinary'))).to.equal(false);
    expect(isCanaError(null)).to.equal(false);
    expect(isCanaErrorCode(failure, 'NotFound')).to.equal(true);
    expect(isCanaErrorCode(failure, 'QuotaExceeded')).to.equal(false);
  });
});

describe('schema validation edge cases', () => {
  it('rejects a store with no name', () => {
    expect(validateSchema(schema({ stores: [{ name: '', keyPath: 'id' }] })))
      .to.include('a store has no name');
  });

  it('rejects an empty schema', () => {
    expect(validateSchema(schema({ stores: [] }))).to.include('schema declares no stores');
  });

  it('rejects an empty segment inside a compound keyPath', () => {
    const problems = validateSchema(schema({
      stores: [{ name: 'designs', keyPath: ['tenantId', ''] }]
    }));

    expect(problems.some((entry) => entry.includes('empty segment'))).to.equal(true);
  });

  it('rejects an empty string keyPath', () => {
    const problems = validateSchema(schema({ stores: [{ name: 'designs', keyPath: '' }] }));

    expect(problems.some((entry) => entry.includes('non-empty string'))).to.equal(true);
  });

  it('rejects an index with no name', () => {
    const problems = validateSchema(schema({
      stores: [{ name: 'designs', keyPath: 'id', indexes: [{ name: '', keyPath: 'x' }] }]
    }));

    expect(problems.some((entry) => entry.includes('an index has no name'))).to.equal(true);
  });

  it('rejects a non-integer version', () => {
    expect(validateSchema(schema({ version: 1.5 }))[0]).to.include('positive integer');
  });

  it('classifies every key strategy', () => {
    // The four shapes drive whether an explicit key is legal at call time.
    expect(keyStrategyOf({ name: 'a', keyPath: 'id' })).to.equal('inbound');
    expect(keyStrategyOf({ name: 'a' })).to.equal('outbound');
    expect(keyStrategyOf({ name: 'a', keyPath: 'id', autoIncrement: true }))
      .to.equal('generated-inbound');
    expect(keyStrategyOf({ name: 'a', autoIncrement: true })).to.equal('generated-outbound');
  });
});

describe('query planning edge cases', () => {
  it('builds a lower-only bound', () => {
    const range = toKeyRange({ range: { lower: 10 } });

    expect(range?.lower).to.equal(10);
    expect(range?.upper).to.equal(undefined);
  });

  it('builds an upper-only bound', () => {
    const range = toKeyRange({ range: { upper: 10 } });

    expect(range?.upper).to.equal(10);
    expect(range?.lower).to.equal(undefined);
  });

  it('returns null for an unbounded or absent query', () => {
    expect(toKeyRange(undefined)).to.equal(null);
    expect(toKeyRange({})).to.equal(null);
    expect(toKeyRange({ range: {} })).to.equal(null);
  });

  it('prefers equals over range when both are given', () => {
    const range = toKeyRange({ equals: 5, range: { lower: 1, upper: 9 } });

    expect(range?.lower).to.equal(5);
    expect(range?.upper).to.equal(5);
  });

  it('reports a plan for an index with no bound as not a full scan', () => {
    // Naming an index narrows the read even without a range, so it is not the
    // degrade-with-volume case `fullScan` exists to flag.
    const plan = planQuery('designs', { index: 'byOwner' });

    expect(plan).to.deep.equal({
      store: 'designs',
      usedIndex: 'byOwner',
      fullScan: false,
      boundedByRange: false,
      appliedOffsetInCursor: false
    });
  });

  it('reports a bounded scan without an index', () => {
    const plan = planQuery('designs', { range: { lower: 1 } });

    expect(plan.fullScan).to.equal(false);
    expect(plan.boundedByRange).to.equal(true);
    expect(plan.usedIndex).to.equal(undefined);
  });

  it('applies distinct as a unique cursor direction', async () => {
    const client = createClient({
      name: 'designer',
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

    expect(rows).to.have.lengthOf(2);
    await client.close();
  });

  it('counts zero on an empty store without materialising', async () => {
    const client = createClient({ name: 'designer', schema: schema() });
    await client.open();

    expect(await client.table<Design>('designs').count()).to.equal(0);
    await client.close();
  });
});

describe('database lifecycle edge cases', () => {
  it('reports Unavailable when no factory and no global exist', async () => {
    // The private-browsing path. Covered here by removing the global, which is
    // the same condition the browser presents.
    const saved = Reflect.get(globalThis, 'indexedDB');
    Reflect.deleteProperty(globalThis as object, 'indexedDB');
    try {
      const failure = await openDatabase({ name: 'designer', schema: schema() })
        .catch((error: unknown) => error);

      expect(isCanaErrorCode(failure, 'Unavailable')).to.equal(true);
      expect((failure as { message: string }).message).to.include('no fallback');
    } finally {
      Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: saved });
    }
  });

  it('closes a database through the exported helper', async () => {
    const factory = indexedDB;
    const { database } = await openDatabase({ name: 'designer', factory, schema: schema() });

    expect(() => closeDatabase(database)).not.to.throw();
  });

  it('deletes a database that exists, and one that does not', async () => {
    const factory = indexedDB;
    const { database } = await openDatabase({ name: 'designer', factory, schema: schema() });
    database.close();

    expect(await deleteDatabase('designer', { factory })).to.equal(undefined);
    // Deleting an absent database succeeds in IndexedDB; it must not be an error.
    expect(await deleteDatabase('never-existed', { factory })).to.equal(undefined);
  });

  it('reports Unavailable from deleteDatabase with no factory or global', async () => {
    const saved = Reflect.get(globalThis, 'indexedDB');
    Reflect.deleteProperty(globalThis as object, 'indexedDB');
    try {
      expect(await rejection(deleteDatabase('designer'))).to.deep.include({ code: 'Unavailable' });
    } finally {
      Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: saved });
    }
  });

  it('never lets a raw DOMException escape an upgrade', async () => {
    // The boundary property, asserted unconditionally: whatever the browser does
    // inside a versionchange transaction, callers see Cana types or nothing.
    const factory = indexedDB;
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

    expect(outcome).not.to.be.instanceOf(Error);
    (outcome as { database?: IDBDatabase }).database?.close();
  });
});

describe('storage durability edge cases', () => {
  it('reports unknown persistence when the API is entirely absent', async () => {
    // 'unknown' rather than false: the browser refusing and the API not existing
    // are different facts, and flattening them lets an app claim a guarantee.
    const durability = new StorageDurability({});

    expect(await durability.requestPersistence()).to.equal('unknown');
    expect(await durability.state()).to.deep.include({ persistent: 'unknown' });
  });

  it('returns true without asking again when already persisted', async () => {
    let persistCalls = 0;
    const durability = new StorageDurability({
      persisted: async () => true,
      persist: async () => { persistCalls += 1; return true; }
    });

    expect(await durability.requestPersistence()).to.equal(true);
    expect(persistCalls).to.equal(0);
  });

  it('falls back to unknown when the persistence API throws', async () => {
    const durability = new StorageDurability({
      persisted: async () => { throw new Error('blocked'); }
    });

    expect(await durability.requestPersistence()).to.equal('unknown');
    expect(await durability.state()).to.deep.include({ persistent: 'unknown' });
  });

  it('reports no usage when estimate is absent or throws', async () => {
    const absent = new StorageDurability({});
    const throwing = new StorageDurability({
      estimate: async () => { throw new Error('denied'); }
    });

    expect(await absent.state()).to.deep.include({ nearQuota: false });
    expect(await throwing.state()).to.deep.include({ nearQuota: false });
  });

  it('reports nearQuota once usage crosses the ratio', async () => {
    const durability = new StorageDurability({
      estimate: async () => ({ usage: 90, quota: 100 })
    });

    expect(await durability.state()).to.deep.include({
      nearQuota: true, usageBytes: 90, quotaBytes: 100
    });
  });

  it('reports recordExistence failure rather than pretending it worked', () => {
    // Returning false is what tells the caller eviction will be undetectable.
    const noTombstone = new StorageDurability({});

    expect(noTombstone.recordExistence('designer', 1)).to.equal(false);
  });

  it('survives a tombstone that throws on write', () => {
    // Private browsing throws on localStorage writes in some browsers.
    // Undetectable, not fatal.
    const durability = new StorageDurability({
      tombstone: {
        get: () => null,
        set: () => { throw new Error('private mode'); },
        remove: () => undefined
      }
    });

    expect(durability.recordExistence('designer', 1)).to.equal(false);
  });

  it('treats a tombstone that throws on read as absent', () => {
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

    expect(verdict.reason).to.equal('first-run');
  });

  it('reports undetectable when there is no tombstone at all', () => {
    const durability = new StorageDurability({});

    expect(durability.evaluateOpen({
      databaseName: 'designer', foundVersion: 0, isEmpty: true
    })).to.deep.equal({ evicted: false, reason: 'undetectable-no-tombstone' });
  });

  it('clears the eviction flag once acknowledged', async () => {
    const durability = new StorageDurability({ tombstone: memoryTombstone().tombstone });
    durability.recordExistence('designer', 1);
    durability.evaluateOpen({ databaseName: 'designer', foundVersion: 0, isEmpty: true });

    expect(await durability.state()).to.deep.include({ evicted: true });
    durability.acknowledgeEviction();

    expect(await durability.state()).to.deep.include({ evicted: false });
  });

  it('exposes the last verdict', () => {
    const durability = new StorageDurability({});

    expect(durability.lastEvictionVerdict).to.equal(null);
    durability.evaluateOpen({ databaseName: 'designer', foundVersion: 0, isEmpty: true });

    expect(durability.lastEvictionVerdict).not.to.equal(null);
  });

  it('reports an empty-but-present database as evicted when it once held data', () => {
    // Some browsers recreate the store shell while dropping the contents. The
    // tombstone's `hadData` is what makes this distinguishable from a database
    // the user simply never wrote to.
    const verdict = classifyOpen(
      { databaseName: 'designer', foundVersion: 1, isEmpty: true },
      JSON.stringify({ version: 1, at: Date.now(), hadData: true })
    );

    expect(verdict).to.deep.equal({ evicted: true, reason: 'evicted-database-empty' });
  });

  /**
   * The Node version of this test asserted the opposite — that the environment
   * has no tombstone — because `localStorage` does not exist under a test
   * runner. That was a true statement about the runner and a false one about
   * every place this code ships to.
   *
   * A browser has `localStorage`, so the tombstone is built, and it is a real
   * one: written, read back and removed through the browser's own storage.
   * That is the behaviour eviction detection depends on, and it could not be
   * tested at all before this suite ran in a browser.
   */
  it('builds a tombstone over the browser\'s own localStorage', () => {
    const { tombstone } = browserStorageEnvironment();

    expect(tombstone).to.not.equal(undefined);

    tombstone?.set('cana-tombstone-probe', 'written');

    expect(tombstone?.get('cana-tombstone-probe')).to.equal('written');
    expect(localStorage.getItem('cana-tombstone-probe')).to.equal('written');

    tombstone?.remove('cana-tombstone-probe');

    expect(tombstone?.get('cana-tombstone-probe')).to.equal(null);
  });
});

describe('table edge cases', () => {
  it('rejects a missing explicit key on an outbound store', async () => {
    const client = createClient({
      name: 'designer',
      schema: schema({ stores: [{ name: 'designs' }] })
    });
    await client.open();

    const failure = await client.table<Design>('designs')
      .add({ id: 1, name: 'a' })
      .catch((error: unknown) => error);

    expect(isCanaErrorCode(failure, 'InvalidRequest')).to.equal(true);
    expect((failure as { message: string }).message).to.include('outbound keys');
    await client.close();
  });

  it('accepts an explicit key on an outbound store', async () => {
    const client = createClient({
      name: 'designer',
      schema: schema({ stores: [{ name: 'designs' }] })
    });
    await client.open();

    const written = await client.table<Design, string>('designs').put({ id: 1, name: 'a' }, 'k1');

    expect(written.key).to.equal('k1');
    expect(await client.table<Design, string>('designs').get('k1')).to.deep.include({ name: 'a' });
    await client.close();
  });

  it('updates through an outbound key', async () => {
    const client = createClient({
      name: 'designer',
      schema: schema({ stores: [{ name: 'designs' }] })
    });
    await client.open();
    const table = client.table<Design, string>('designs');
    await table.put({ id: 1, name: 'a' }, 'k1');

    await table.update('k1', { name: 'renamed' });

    expect(await table.get('k1')).to.deep.include({ name: 'renamed' });
    await client.close();
  });

  it('resolves a compound inbound key when classifying a bulk put', async () => {
    const client = createClient({
      name: 'designer',
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

    expect(events.map((event) => event.type)).to.deep.equal(['updated', 'created']);
    await client.close();
  });

  it('reports a store outside the transaction scope', async () => {
    // The most common misuse after the auto-commit one.
    const client = createClient({
      name: 'designer',
      schema: schema({ stores: [{ name: 'designs', keyPath: 'id' }, { name: 'notes', keyPath: 'id' }] })
    });
    await client.open();

    const failure = await client.transaction('readwrite', ['designs'], async (scope) => {
      await scope.table('notes').add({ id: 1 });
    }).catch((error: unknown) => error);

    expect(isCanaError(failure)).to.equal(true);
    await client.close();
  });

  it('clears a store and reports one cleared event', async () => {
    const client = createClient({ name: 'designer', schema: schema() });
    await client.open();
    await client.table<Design>('designs').bulkAdd([{ id: 1, name: 'a' }, { id: 2, name: 'b' }]);

    const cleared = await client.table<Design>('designs').clear();

    expect(cleared.events.map((event) => event.type)).to.deep.equal(['cleared']);
    expect(await client.table<Design>('designs').count()).to.equal(0);
    await client.close();
  });

  it('reports an empty bulk write as committed with no keys', async () => {
    const client = createClient({ name: 'designer', schema: schema() });
    await client.open();

    const result = await client.table<Design>('designs').bulkAdd([]);

    expect(result.outcome).to.equal('committed');
    expect(result.keys).to.deep.equal([]);
    await client.close();
  });
});

describe('client edge cases', () => {
  it('is idempotent on open and on close', async () => {
    const client = createClient({ name: 'designer', schema: schema() });
    await client.open();

    expect(await client.open()).to.equal(undefined);
    await client.close();
    expect(await client.close()).to.equal(undefined);
  });

  it('exposes name and version from the schema', () => {
    const client = createClient({
      name: 'designer', schema: schema({ version: 7 })
    });

    expect(client.name).to.equal('designer');
    expect(client.version).to.equal(7);
  });

  it('tags events with the configured originId so a tab can ignore its own echo', async () => {
    const client = createClient({
      name: 'designer', schema: schema(), originId: 'tab-a'
    });
    await client.open();

    const { events } = await client.table<Design>('designs').add({ id: 1, name: 'a' });

    expect(events[0].originId).to.equal('tab-a');
    await client.close();
  });

  it('replays nothing when subscribing with no history', async () => {
    const client = createClient({ name: 'designer', schema: schema() });
    await client.open();
    const seen: number[] = [];

    client.subscribe((event) => seen.push(event.cursor), { sinceCursor: 0 });

    expect(seen).to.deep.equal([]);
    await client.close();
  });

  it('refuses storageState-driven work before open for exportAll', async () => {
    const client = createClient({ name: 'designer', schema: schema() });

    expect(await rejection(client.exportAll())).to.deep.include({ code: 'InvalidRequest' });
  });

  it('reports storage state without a database being open', async () => {
    // Durability is a property of the origin, not of a connection.
    const client = createClient({ name: 'designer', schema: schema() });

    expect(await client.storageState()).to.deep.include({ evicted: false });
  });

  it('exports an empty database as empty arrays, not as a failure', async () => {
    const client = createClient({ name: 'designer', schema: schema() });
    await client.open();

    expect(await client.exportAll()).to.deep.equal({ designs: [] });
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
    let listener: ((event: { data: unknown }) => void) | undefined;
    const router = createRouter({
      port: {
        postMessage: () => undefined,
        addEventListener: (_type, handler) => { listener = handler; },
        removeEventListener: () => undefined
      }
    });

    expect(() => listener?.({ data: null })).not.to.throw();
    expect(() => listener?.({ data: 'not an object' })).not.to.throw();
    router.dispose();
  });

  it('supplies a default error when the worker reports a failure with no detail', async () => {
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

    expect(await rejection(pending)).to.deep.include({ code: 'Internal' });
    router.dispose();
  });

  it('reports zero pending on a fresh router', () => {
    const router = createRouter({ port: inertPort() });

    expect(router.pendingCount).to.equal(0);
    router.dispose();
  });

  it('tolerates a broadcast with no handler registered', () => {
    let listener: ((event: { data: unknown }) => void) | undefined;
    const router = createRouter({
      port: {
        postMessage: () => undefined,
        addEventListener: (_type, handler) => { listener = handler; },
        removeEventListener: () => undefined
      }
    });

    expect(() => listener?.({ data: { kind: 'change', event: {} } })).not.to.throw();
    router.dispose();
  });
});
