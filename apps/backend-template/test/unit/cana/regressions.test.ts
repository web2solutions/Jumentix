import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import type { CanaChangeEvent, CanaSchema } from '@jumentix/cana';
import {
  OPERATION_LEDGER_STORE,
  StorageDurability,
  browserStorageEnvironment,
  classifyOpen,
  createClient,
  isCanaErrorCode,
  openDatabase
} from '@jumentix/cana';

/**
 * Regression tests for the seven defects found in review of PR #15.
 *
 * Each one is written to fail against the code as it was, not merely to pass
 * against the code as it is. Where a fix changed a decision, the test asserts
 * the decision — so a future revert is caught rather than silently accepted.
 */

interface Design { id: number; name: string }

const schema = (version = 1): CanaSchema => ({
  version,
  stores: [{ name: 'designs', keyPath: 'id' }]
});

const tombstoneEnvironment = () => {
  const store = new Map<string, string>();
  return {
    tombstone: {
      get: (key: string) => store.get(key) ?? null,
      set: (key: string, value: string) => { store.set(key, value); },
      remove: (key: string) => { store.delete(key); }
    }
  };
};

describe('regression: false eviction when the version probe cannot answer', () => {
  it('does not call a populated database evicted when foundVersion is unknown', () => {
    expect.hasAssertions();
    // `IDBFactory.databases()` is absent in some browsers — Safari lacked it for
    // years. The old `currentVersion` returned 0 in that case, and 0 means
    // "absent" to the classifier, so every open in those browsers reported a
    // healthy database as evicted.
    const verdict = classifyOpen(
      { databaseName: 'designer', foundVersion: undefined, isEmpty: false },
      JSON.stringify({ version: 1, at: Date.now() })
    );

    expect(verdict).toStrictEqual({ evicted: false, reason: 'existing-data' });
  });

  it('still reports eviction when the database is genuinely absent', () => {
    expect.hasAssertions();
    // The control: 0 must keep meaning absent, or the fix would have traded one
    // wrong answer for another.
    const verdict = classifyOpen(
      { databaseName: 'designer', foundVersion: 0, isEmpty: true },
      JSON.stringify({ version: 1, at: Date.now() })
    );

    expect(verdict).toStrictEqual({ evicted: true, reason: 'evicted-database-absent' });
  });

  it('reports existing data as such when databases() is missing entirely', async () => {
    expect.hasAssertions();
    // End-to-end version, against a factory with `databases` removed.
    const factory = new IDBFactory();
    const durability = new StorageDurability(tombstoneEnvironment());

    const first = await openDatabase({
      name: 'designer', factory, schema: schema(), durability
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = first.database.transaction('designs', 'readwrite');
      transaction.objectStore('designs').add({ id: 1, name: 'kept' });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    first.database.close();

    // Simulate a browser without `databases()`.
    const blind = Object.create(factory) as IDBFactory;
    Object.defineProperty(blind, 'databases', { value: undefined });

    const second = await openDatabase({
      name: 'designer', factory: blind, schema: schema(), durability
    });

    expect(second.eviction.evicted).toBe(false);
    second.database.close();
  });
});

describe('regression: bulkPut labelled every row as updated', () => {
  it('reports created for new rows and updated for existing ones', async () => {
    expect.hasAssertions();
    // The single `put` had always probed; the bulk path hardcoded 'updated', so
    // a subscriber driving an incremental UI never learned a row had appeared.
    const client = createClient({ name: 'designer', schema: schema(), factory: new IDBFactory() });
    await client.open();
    await client.table<Design>('designs').add({ id: 1, name: 'existing' });

    const { events } = await client.table<Design>('designs')
      .bulkPut([{ id: 1, name: 'changed' }, { id: 2, name: 'brand new' }]);

    expect(events.map((event) => event.type)).toStrictEqual(['updated', 'created']);
    await client.close();
  });

  it('passes the right type to beforeWrite as well', async () => {
    expect.hasAssertions();
    const seen: string[] = [];
    const client = createClient({
      name: 'designer',
      schema: schema(),
      factory: new IDBFactory(),
      hooks: { beforeWrite: (context) => { seen.push(context.type); } }
    });
    await client.open();
    await client.table<Design>('designs').add({ id: 1, name: 'existing' });
    seen.length = 0;

    await client.table<Design>('designs')
      .bulkPut([{ id: 1, name: 'changed' }, { id: 2, name: 'brand new' }]);

    expect(seen).toStrictEqual(['updated', 'created']);
    await client.close();
  });
});

describe('regression: change events were missing the contractual timestamp', () => {
  it('stamps every published event with at', async () => {
    expect.hasAssertions();
    // `CanaChangeEvent.at` is required by the contract, but the buffer only set
    // cursor and originId. It typechecked solely because the buffer asserted
    // `as CanaChangeEvent` over a spread — the cast defeated the one check that
    // would have caught it.
    const client = createClient({ name: 'designer', schema: schema(), factory: new IDBFactory() });
    await client.open();
    const seen: CanaChangeEvent[] = [];
    client.subscribe((event) => seen.push(event));

    const before = Date.now();
    await client.table<Design>('designs').add({ id: 1, name: 'a' });

    expect(seen).toHaveLength(1);
    expect(typeof seen[0].at).toBe('number');
    expect(seen[0].at).toBeGreaterThanOrEqual(before);
    await client.close();
  });

  it('stamps replayed events too', async () => {
    expect.hasAssertions();
    const client = createClient({ name: 'designer', schema: schema(), factory: new IDBFactory() });
    await client.open();
    await client.table<Design>('designs').add({ id: 1, name: 'a' });

    const replayed: CanaChangeEvent[] = [];
    client.subscribe((event) => replayed.push(event), { sinceCursor: 0 });

    expect(replayed).toHaveLength(1);
    expect(typeof replayed[0].at).toBe('number');
    await client.close();
  });
});

describe('regression: ledger silently did nothing without a version bump', () => {
  it('refuses to open rather than recording nothing', async () => {
    expect.hasAssertions();
    // Enabling the ledger adds its store to the schema, but IndexedDB only
    // applies schema changes when the version increases. Against an existing
    // database at the same version the store was never created, the ledger
    // quietly switched itself off, and every later resolveWrite answered
    // 'unresolvable' with no indication why.
    const factory = new IDBFactory();
    const plain = createClient({ name: 'designer', schema: schema(1), factory });
    await plain.open();
    await plain.close();

    const ledgered = createClient({
      name: 'designer', schema: schema(1), factory, operationLedger: true
    });

    const failure = await ledgered.open().catch((error: unknown) => error);

    expect(isCanaErrorCode(failure, 'UpgradeFailed')).toBe(true);
    expect((failure as { message: string }).message).toContain('version increases');
  });

  it('works once the version is raised', async () => {
    expect.hasAssertions();
    // The control: the error must be actionable, and the stated action must work.
    const factory = new IDBFactory();
    const plain = createClient({ name: 'designer', schema: schema(1), factory });
    await plain.open();
    await plain.close();

    const ledgered = createClient({
      name: 'designer', schema: schema(2), factory, operationLedger: true
    });
    await ledgered.open();

    await expect(ledgered.table(OPERATION_LEDGER_STORE).count()).resolves.toBe(0);
    await ledgered.close();
  });
});

describe('regression: unknown outcome could not be reconciled', () => {
  it('returns correlationId and attemptedAt on a committed transaction', async () => {
    expect.hasAssertions();
    // The result previously carried neither, so a caller handed 'unknown' — the
    // one outcome that must be reconciled — had nothing to pass to resolveWrite.
    const client = createClient({
      name: 'designer', schema: schema(), factory: new IDBFactory(), operationLedger: true
    });
    await client.open();

    const result = await client.transaction('readwrite', ['designs'], async (scope) => {
      await scope.table<Design>('designs').add({ id: 1, name: 'a' });
    });

    expect(typeof result.correlationId).toBe('string');
    expect(typeof result.attemptedAt).toBe('number');
    await expect(client.resolveWrite(result.correlationId, result.attemptedAt))
      .resolves.toBe('committed');
    await client.close();
  });

  it('records the ledger row before the body, so an auto-commit is still traceable', async () => {
    expect.hasAssertions();
    // The row used to be written after the body. If the body wrote, IndexedDB
    // auto-committed, and the body then threw, the transaction committed with no
    // ledger row — and resolveWrite answered 'rolled-back' for data that was on
    // disk, inviting the duplicate write the ledger exists to prevent.
    //
    // Recording first is observable: the row is present even for a transaction
    // whose body did nothing else.
    const client = createClient({
      name: 'designer', schema: schema(), factory: new IDBFactory(), operationLedger: true
    });
    await client.open();

    const result = await client.transaction('readwrite', ['designs'], async () => undefined);

    const rows = await client.table<{ id: string }>(OPERATION_LEDGER_STORE).query();

    expect(rows.map((row) => row.id)).toContain(result.correlationId);
    await client.close();
  });

  it('still leaves no ledger row when the transaction aborts', async () => {
    expect.hasAssertions();
    // Recording first must not have broken the other direction: the shared
    // transaction is what guarantees the row rolls back with the data.
    const client = createClient({
      name: 'designer', schema: schema(), factory: new IDBFactory(), operationLedger: true
    });
    await client.open();

    await client.transaction('readwrite', ['designs'], async (scope) => {
      await scope.table<Design>('designs').add({ id: 1, name: 'a' });
      scope.abort();
    }).catch(() => undefined);

    await expect(client.table(OPERATION_LEDGER_STORE).count()).resolves.toBe(0);
    await expect(client.table<Design>('designs').count()).resolves.toBe(0);
    await client.close();
  });
});

describe('regression: eviction detection was off by default', () => {
  // The suite runs under `testEnvironment: 'node'`, which has no localStorage.
  // A browser does, so it is installed for these tests — that is the condition
  // under which the defect actually mattered, and asserting anything without it
  // would be asserting about the wrong environment.
  const withLocalStorage = () => {
    const backing = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => backing.get(key) ?? null,
        setItem: (key: string, value: string) => { backing.set(key, String(value)); },
        removeItem: (key: string) => { backing.delete(key); }
      }
    });
    return backing;
  };

  afterEach(() => {
    Reflect.deleteProperty(globalThis as object, 'localStorage');
  });

  it('builds a tombstone from localStorage when one exists', () => {
    expect.hasAssertions();
    withLocalStorage();

    expect(browserStorageEnvironment().tombstone).toBeDefined();
  });

  it('reports eviction as detectable with no durability injected', async () => {
    expect.hasAssertions();
    // `createClient` defaulted to `new StorageDurability({})` — an environment
    // with no tombstone at all — so recordExistence always failed and eviction
    // stayed 'undetectable-no-tombstone' in normal browser use, despite the
    // documentation describing localStorage markers for JUM-560. No caller
    // injects durability here, which is the whole point.
    withLocalStorage();
    const client = createClient({ name: 'designer', schema: schema(), factory: new IDBFactory() });
    await client.open();

    const assessment = await client.durabilityAssessment();

    expect(assessment.evictionDetectable).toBe(true);
    await client.close();
  });

  it('detects an actual eviction end to end with the default environment', async () => {
    expect.hasAssertions();
    // The property the tombstone exists for, exercised through the default
    // rather than through an injected fake.
    const backing = withLocalStorage();
    const factory = new IDBFactory();

    const first = createClient({ name: 'designer', schema: schema(), factory });
    await first.open();
    await first.close();

    expect(backing.size).toBeGreaterThan(0);

    await new Promise<void>((resolve) => {
      const request = factory.deleteDatabase('designer');
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });

    const second = createClient({ name: 'designer', schema: schema(), factory });
    await second.open();

    const assessment = await second.durabilityAssessment();

    expect(assessment.level).toBe('lost');
    await second.close();
  });
});
