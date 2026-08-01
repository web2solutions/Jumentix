import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import type { CanaSchema } from '@jumentix/cana';
import {
  OPERATION_LEDGER_STORE,
  createClient,
  pruneLedger,
  withLedgerStore
} from '@jumentix/cana';

/**
 * The ledger's whole claim is that the operation id and the data commit or roll
 * back together. That is only worth anything if it is checked against a real
 * IndexedDB — the atomicity being relied on is the store's, not the engine's.
 */

interface Design { id: number; name: string }

const schema: CanaSchema = {
  version: 1,
  stores: [{ name: 'designs', keyPath: 'id' }]
};

async function ledgeredClient(factory = new IDBFactory()) {
  const client = createClient({
    name: 'designer', schema, factory, operationLedger: true
  });
  await client.open();
  return client;
}

/** Read the ledger directly, so the test does not depend on the API under test. */
async function ledgerIds(client: Awaited<ReturnType<typeof ledgeredClient>>): Promise<string[]> {
  const rows = await client.table<{ id: string }>(OPERATION_LEDGER_STORE).query();
  return rows.map((row) => row.id).sort();
}

/** Open the same database directly, for the functions that take an IDBDatabase. */
function openRaw(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open('designer');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

describe('cana operation ledger', () => {
  it('adds its store to the schema so the application cannot forget it', async () => {
    expect.hasAssertions();
    const client = await ledgeredClient();

    await expect(client.table(OPERATION_LEDGER_STORE).count()).resolves.toBe(0);
    await client.close();
  });

  it('does not create the store when the ledger is off', async () => {
    expect.hasAssertions();
    // It costs a request per transaction, so it is opt-in.
    const client = createClient({ name: 'designer', schema, factory: new IDBFactory() });
    await client.open();

    const failure = await client.table(OPERATION_LEDGER_STORE).count()
      .catch((error: unknown) => error);

    expect(failure).toBeDefined();
    await client.close();
  });

  it('records an entry for a committed write', async () => {
    expect.hasAssertions();
    const client = await ledgeredClient();
    await client.table<Design>('designs').add({ id: 1, name: 'a' });

    await expect(ledgerIds(client)).resolves.toHaveLength(1);
    await client.close();
  });

  it('records nothing when the transaction aborts', async () => {
    expect.hasAssertions();
    // The property the whole design rests on. If the id survived an abort it
    // would claim a commit that never happened, and reconciliation would then
    // confidently skip a write that was actually lost.
    const client = await ledgeredClient();

    await client.transaction('readwrite', ['designs'], async (scope) => {
      await scope.table<Design>('designs').add({ id: 1, name: 'a' });
      scope.abort();
    }).catch(() => undefined);

    await expect(ledgerIds(client)).resolves.toStrictEqual([]);
    await expect(client.table<Design>('designs').count()).resolves.toBe(0);
    await client.close();
  });

  it('keeps the id and the data consistent with each other', async () => {
    expect.hasAssertions();
    // One committed and one aborted transaction: the ledger must have exactly
    // one entry, and the store exactly one row. Either being out of step means
    // the two are not actually sharing a transaction.
    const client = await ledgeredClient();

    await client.table<Design>('designs').add({ id: 1, name: 'kept' });
    await client.transaction('readwrite', ['designs'], async (scope) => {
      await scope.table<Design>('designs').add({ id: 2, name: 'discarded' });
      scope.abort();
    }).catch(() => undefined);

    await expect(ledgerIds(client)).resolves.toHaveLength(1);
    await expect(client.table<Design>('designs').count()).resolves.toBe(1);
    await client.close();
  });

  it('does not write a ledger entry for a read-only transaction', async () => {
    expect.hasAssertions();
    const client = await ledgeredClient();
    await client.table<Design>('designs').query();

    await expect(ledgerIds(client)).resolves.toStrictEqual([]);
    await client.close();
  });
});

describe('cana write resolution', () => {
  it('resolves a committed write as committed', async () => {
    expect.hasAssertions();
    const client = await ledgeredClient();
    const { events } = await client.transaction('readwrite', ['designs'], async (scope) => {
      await scope.table<Design>('designs').add({ id: 1, name: 'a' });
    });

    const { correlationId } = events[0];

    await expect(client.resolveWrite(correlationId, Date.now())).resolves.toBe('committed');
    await client.close();
  });

  it('survives a close and reopen, which is the point', async () => {
    expect.hasAssertions();
    // In-memory state does not survive a killed worker. The ledger is on disk,
    // so the answer must still be available to a client that never saw the
    // original write.
    const factory = new IDBFactory();
    const first = await ledgeredClient(factory);
    const { events } = await first.transaction('readwrite', ['designs'], async (scope) => {
      await scope.table<Design>('designs').add({ id: 1, name: 'a' });
    });
    const { correlationId } = events[0];
    await first.close();

    const second = await ledgeredClient(factory);

    await expect(second.resolveWrite(correlationId, Date.now())).resolves.toBe('committed');
    await second.close();
  });

  it('resolves an id that was never committed as rolled-back', async () => {
    expect.hasAssertions();
    const client = await ledgeredClient();
    await client.table<Design>('designs').add({ id: 1, name: 'a' });

    await expect(client.resolveWrite('never-happened:1', Date.now()))
      .resolves.toBe('rolled-back');
    await client.close();
  });

  it('says unresolvable rather than rolled-back once the entry could have been pruned', async () => {
    expect.hasAssertions();
    // The distinction that prevents the duplicate-write bug. An absent id past
    // the horizon might have committed and been pruned; calling that
    // "rolled-back" would tell a caller to safely retry a write that already
    // landed.
    const client = await ledgeredClient();
    const longAgo = Date.now() - (48 * 60 * 60 * 1000);

    await expect(client.resolveWrite('ancient:1', longAgo))
      .resolves.toBe('unresolvable');
    await client.close();
  });

  it('is unresolvable when the ledger was never enabled', async () => {
    expect.hasAssertions();
    // No evidence is not evidence of absence.
    const client = createClient({ name: 'designer', schema, factory: new IDBFactory() });
    await client.open();

    await expect(client.resolveWrite('anything:1', Date.now()))
      .resolves.toBe('unresolvable');
    await client.close();
  });
});

describe('cana ledger pruning', () => {
  it('deletes entries older than the horizon and keeps the rest', async () => {
    expect.hasAssertions();
    const factory = new IDBFactory();
    const client = await ledgeredClient(factory);
    await client.table<Design>('designs').add({ id: 1, name: 'recent' });

    // Backdate one entry, which is the only way to age it without waiting. Note
    // that this put is itself a ledgered write and so adds an entry of its own —
    // which is why the assertions below name ids rather than count rows.
    const ledger = client.table<{ id: string; at: number }>(OPERATION_LEDGER_STORE);
    const [existing] = await ledger.query();
    await ledger.put({ ...existing, id: 'old:1', at: Date.now() - (48 * 60 * 60 * 1000) });

    await expect(ledgerIds(client)).resolves.toContain('old:1');

    const database = await openRaw(factory);
    const removed = await pruneLedger(database, { horizonMs: 24 * 60 * 60 * 1000 });
    database.close();

    const survivors = await ledgerIds(client);

    expect(removed).toBe(1);
    expect(survivors).not.toContain('old:1');
    // The recent entries are untouched: pruning is bounded by the horizon, not
    // a clear-out.
    expect(survivors.length).toBeGreaterThan(0);
    await client.close();
  });

  it('returns zero when there is no ledger store', async () => {
    expect.hasAssertions();
    const factory = new IDBFactory();
    const client = createClient({ name: 'designer', schema, factory });
    await client.open();
    await client.close();

    const database = await openRaw(factory);

    await expect(pruneLedger(database)).resolves.toBe(0);
    database.close();
  });
});

describe('withLedgerStore', () => {
  it('adds the store once and is idempotent', () => {
    expect.hasAssertions();
    const once = withLedgerStore(schema.stores);
    const twice = withLedgerStore(once as typeof schema.stores);

    expect(once).toHaveLength(2);
    expect(twice).toHaveLength(2);
  });
});
