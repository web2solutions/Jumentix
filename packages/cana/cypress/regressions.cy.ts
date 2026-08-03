import type { CanaChangeEvent, CanaSchema } from '../src';
import {
  OPERATION_LEDGER_STORE,
  StorageDurability,
  browserStorageEnvironment,
  classifyOpen,
  createClient,
  deleteDatabase,
  isCanaErrorCode,
  openDatabase
} from '../src';
import { rejection, thrownBy } from './harness';

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
    // `IDBFactory.databases()` is absent in some browsers — Safari lacked it for
    // years. The old `currentVersion` returned 0 in that case, and 0 means
    // "absent" to the classifier, so every open in those browsers reported a
    // healthy database as evicted.
    const verdict = classifyOpen(
      { databaseName: 'designer', foundVersion: undefined, isEmpty: false },
      JSON.stringify({ version: 1, at: Date.now() })
    );

    expect(verdict).to.deep.equal({ evicted: false, reason: 'existing-data' });
  });

  it('still reports eviction when the database is genuinely absent', () => {
    // The control: 0 must keep meaning absent, or the fix would have traded one
    // wrong answer for another.
    const verdict = classifyOpen(
      { databaseName: 'designer', foundVersion: 0, isEmpty: true },
      JSON.stringify({ version: 1, at: Date.now() })
    );

    expect(verdict).to.deep.equal({ evicted: true, reason: 'evicted-database-absent' });
  });

  it('reports existing data as such when databases() is missing entirely', async () => {
    // End-to-end version, against a factory with `databases` removed.
    const factory = indexedDB;
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

    // A browser without `databases()`, which Safari was until 2022.
    //
    // Not `Object.create(factory)`: an IDBFactory method called on an ordinary
    // object whose prototype merely reaches it throws `Illegal invocation` in a
    // real browser. The fake accepted it, so the Node version of this test was
    // exercising a shape no browser permits. This delegates to the browser's
    // own factory and hides one method, which is exactly what the older Safari
    // presented.
    const blind = {
      open: (name: string, version?: number) => factory.open(name, version),
      deleteDatabase: (name: string) => factory.deleteDatabase(name),
      cmp: (left: unknown, right: unknown) => factory.cmp(left, right),
      databases: undefined
    } as unknown as IDBFactory;

    const second = await openDatabase({
      name: 'designer', factory: blind, schema: schema(), durability
    });

    expect(second.eviction.evicted).to.equal(false);
    second.database.close();
  });
});

describe('regression: bulkPut labelled every row as updated', () => {
  it('reports created for new rows and updated for existing ones', async () => {
    // The single `put` had always probed; the bulk path hardcoded 'updated', so
    // a subscriber driving an incremental UI never learned a row had appeared.
    const client = createClient({ name: 'designer', schema: schema() });
    await client.open();
    await client.table<Design>('designs').add({ id: 1, name: 'existing' });

    const { events } = await client.table<Design>('designs')
      .bulkPut([{ id: 1, name: 'changed' }, { id: 2, name: 'brand new' }]);

    expect(events.map((event) => event.type)).to.deep.equal(['updated', 'created']);
    await client.close();
  });

  it('passes the right type to beforeWrite as well', async () => {
    const seen: string[] = [];
    const client = createClient({
      name: 'designer',
      schema: schema(),
      hooks: { beforeWrite: (context) => { seen.push(context.type); } }
    });
    await client.open();
    await client.table<Design>('designs').add({ id: 1, name: 'existing' });
    seen.length = 0;

    await client.table<Design>('designs')
      .bulkPut([{ id: 1, name: 'changed' }, { id: 2, name: 'brand new' }]);

    expect(seen).to.deep.equal(['updated', 'created']);
    await client.close();
  });
});

describe('regression: change events were missing the contractual timestamp', () => {
  it('stamps every published event with at', async () => {
    // `CanaChangeEvent.at` is required by the contract, but the buffer only set
    // cursor and originId. It typechecked solely because the buffer asserted
    // `as CanaChangeEvent` over a spread — the cast defeated the one check that
    // would have caught it.
    const client = createClient({ name: 'designer', schema: schema() });
    await client.open();
    const seen: CanaChangeEvent[] = [];
    client.subscribe((event) => seen.push(event));

    const before = Date.now();
    await client.table<Design>('designs').add({ id: 1, name: 'a' });

    expect(seen).to.have.lengthOf(1);
    expect(typeof seen[0].at).to.equal('number');
    expect(seen[0].at).to.be.at.least(before);
    await client.close();
  });

  it('stamps replayed events too', async () => {
    const client = createClient({ name: 'designer', schema: schema() });
    await client.open();
    await client.table<Design>('designs').add({ id: 1, name: 'a' });

    const replayed: CanaChangeEvent[] = [];
    client.subscribe((event) => replayed.push(event), { sinceCursor: 0 });

    expect(replayed).to.have.lengthOf(1);
    expect(typeof replayed[0].at).to.equal('number');
    await client.close();
  });
});

describe('regression: ledger silently did nothing without a version bump', () => {
  it('refuses to open rather than recording nothing', async () => {
    // Enabling the ledger adds its store to the schema, but IndexedDB only
    // applies schema changes when the version increases. Against an existing
    // database at the same version the store was never created, the ledger
    // quietly switched itself off, and every later resolveWrite answered
    // 'unresolvable' with no indication why.
    const factory = indexedDB;
    const plain = createClient({ name: 'designer', schema: schema(1), factory });
    await plain.open();
    await plain.close();

    const ledgered = createClient({
      name: 'designer', schema: schema(1), factory, operationLedger: true
    });

    const failure = await ledgered.open().catch((error: unknown) => error);

    expect(isCanaErrorCode(failure, 'UpgradeFailed')).to.equal(true);
    expect((failure as { message: string }).message).to.include('version increases');
  });

  it('works once the version is raised', async () => {
    // The control: the error must be actionable, and the stated action must work.
    const factory = indexedDB;
    const plain = createClient({ name: 'designer', schema: schema(1), factory });
    await plain.open();
    await plain.close();

    const ledgered = createClient({
      name: 'designer', schema: schema(2), factory, operationLedger: true
    });
    await ledgered.open();

    expect(await ledgered.table(OPERATION_LEDGER_STORE).count()).to.equal(0);
    await ledgered.close();
  });
});

describe('regression: unknown outcome could not be reconciled', () => {
  it('returns correlationId and attemptedAt on a committed transaction', async () => {
    // The result previously carried neither, so a caller handed 'unknown' — the
    // one outcome that must be reconciled — had nothing to pass to resolveWrite.
    const client = createClient({
      name: 'designer', schema: schema(), operationLedger: true
    });
    await client.open();

    const result = await client.transaction('readwrite', ['designs'], async (scope) => {
      await scope.table<Design>('designs').add({ id: 1, name: 'a' });
    });

    expect(typeof result.correlationId).to.equal('string');
    expect(typeof result.attemptedAt).to.equal('number');
    expect(await client.resolveWrite(result.correlationId, result.attemptedAt)).to.equal('committed');
    await client.close();
  });

  it('records the ledger row before the body, so an auto-commit is still traceable', async () => {
    // The row used to be written after the body. If the body wrote, IndexedDB
    // auto-committed, and the body then threw, the transaction committed with no
    // ledger row — and resolveWrite answered 'rolled-back' for data that was on
    // disk, inviting the duplicate write the ledger exists to prevent.
    //
    // Recording first is observable: the row is present even for a transaction
    // whose body did nothing else.
    const client = createClient({
      name: 'designer', schema: schema(), operationLedger: true
    });
    await client.open();

    const result = await client.transaction('readwrite', ['designs'], async () => undefined);

    const rows = await client.table<{ id: string }>(OPERATION_LEDGER_STORE).query();

    expect(rows.map((row) => row.id)).to.include(result.correlationId);
    await client.close();
  });

  it('still leaves no ledger row when the transaction aborts', async () => {
    // Recording first must not have broken the other direction: the shared
    // transaction is what guarantees the row rolls back with the data.
    const client = createClient({
      name: 'designer', schema: schema(), operationLedger: true
    });
    await client.open();

    await client.transaction('readwrite', ['designs'], async (scope) => {
      await scope.table<Design>('designs').add({ id: 1, name: 'a' });
      scope.abort();
    }).catch(() => undefined);

    expect(await client.table(OPERATION_LEDGER_STORE).count()).to.equal(0);
    expect(await client.table<Design>('designs').count()).to.equal(0);
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
    withLocalStorage();

    expect(browserStorageEnvironment().tombstone).to.not.equal(undefined);
  });

  it('reports eviction as detectable with no durability injected', async () => {
    // `createClient` defaulted to `new StorageDurability({})` — an environment
    // with no tombstone at all — so recordExistence always failed and eviction
    // stayed 'undetectable-no-tombstone' in normal browser use, despite the
    // documentation describing localStorage markers for JUM-560. No caller
    // injects durability here, which is the whole point.
    withLocalStorage();
    const client = createClient({ name: 'designer', schema: schema() });
    await client.open();

    const assessment = await client.durabilityAssessment();

    expect(assessment.evictionDetectable).to.equal(true);
    await client.close();
  });

  it('detects an actual eviction end to end with the default environment', async () => {
    // The property the tombstone exists for, exercised through the default
    // rather than through an injected fake.
    const backing = withLocalStorage();
    const factory = indexedDB;

    const first = createClient({ name: 'designer', schema: schema(), factory });
    await first.open();
    await first.close();

    expect(backing.size).to.be.greaterThan(0);

    await new Promise<void>((resolve) => {
      const request = factory.deleteDatabase('designer');
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });

    const second = createClient({ name: 'designer', schema: schema(), factory });
    await second.open();

    const assessment = await second.durabilityAssessment();

    expect(assessment.level).to.equal('lost');
    await second.close();
  });
});

describe('regression: orphaned connection after a blocked timeout', () => {
  it('closes a connection that arrives after the timeout already rejected', async () => {
    // The timeout rejects, then the open succeeds anyway. Nobody holds the
    // resulting IDBDatabase, so if it is not closed here it keeps blocking
    // version changes in this tab — turning a recoverable timeout into a
    // permanent block, which is exactly what the timeout existed to escape.
    let closed = false;
    const request = {
      onsuccess: null as (() => void) | null,
      onerror: null as (() => void) | null,
      onupgradeneeded: null as (() => void) | null,
      onblocked: null as (() => void) | null,
      result: { close: () => { closed = true; } },
      error: null,
      transaction: null
    };
    const factory = {
      open: () => {
        // Late success, well after the 20ms timeout.
        setTimeout(() => request.onsuccess?.(), 60);
        return request;
      },
      databases: async () => []
    } as unknown as IDBFactory;

    expect(await rejection(openDatabase({
      name: 'designer', schema: schema(), factory, blockedTimeoutMs: 20
    }))).to.deep.include({ code: 'UpgradeBlocked' });

    await new Promise((resolve) => { setTimeout(resolve, 120); });

    expect(closed).to.equal(true);
  });
});

describe('regression: false eviction for a database never written to', () => {
  it('does not report loss when the user simply has not saved anything', async () => {
    // First open records the tombstone. Second open finds the database present
    // and empty — which, before the `hadData` flag, was enough to report
    // `evicted-database-empty`. A user who opened the app and wrote nothing was
    // told their data was gone.
    const factory = indexedDB;
    const durability = new StorageDurability(tombstoneEnvironment());

    const first = await openDatabase({
      name: 'designer', factory, schema: schema(), durability
    });
    first.database.close();

    const second = await openDatabase({
      name: 'designer', factory, schema: schema(), durability
    });

    expect(second.eviction.evicted).to.equal(false);
    second.database.close();
  });

  it('still reports loss once data has actually been written', async () => {
    // The control: the guard must not have disabled real eviction detection.
    const factory = indexedDB;
    const durability = new StorageDurability(tombstoneEnvironment());

    const first = await openDatabase({
      name: 'designer', factory, schema: schema(), durability
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = first.database.transaction('designs', 'readwrite');
      transaction.objectStore('designs').add({ id: 1, name: 'real data' });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    first.database.close();

    // Reopen so `hadData` is recorded from the observed contents.
    const seen = await openDatabase({
      name: 'designer', factory, schema: schema(), durability
    });
    seen.database.close();

    await deleteDatabase('designer', { factory });
    const third = await openDatabase({
      name: 'designer', factory, schema: schema(), durability
    });

    expect(third.eviction.evicted).to.equal(true);
    third.database.close();
  });
});

describe('regression: subscribe leaked a listener when replay was refused', () => {
  it('does not retain a subscription it refused to create', async () => {
    // The entry was pushed before validation, then marked inactive and left in
    // the array with no unsubscribe function to remove it. A caller retrying in
    // a loop grew the list without bound.
    const client = createClient({
      name: 'designer', schema: schema(), retainedEvents: 2
    });
    await client.open();
    await client.table<Design>('designs')
      .bulkAdd([{ id: 1, name: 'a' }, { id: 2, name: 'b' }, { id: 3, name: 'c' }]);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(thrownBy(() => client.subscribe(() => undefined, { sinceCursor: 0 })))
        .to.deep.include({ code: 'NotFound' });
    }

    // A working subscriber must still receive exactly one event per write, which
    // it would not if five dead entries were also being iterated.
    const seen: number[] = [];
    client.subscribe((event) => seen.push(event.cursor));
    await client.table<Design>('designs').add({ id: 4, name: 'd' });

    expect(seen).to.have.lengthOf(1);
    await client.close();
  });
});
