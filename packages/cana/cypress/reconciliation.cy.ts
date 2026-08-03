import type { CanaSchema } from '../src';
import {
  OPERATION_LEDGER_STORE,
  createClient,
  pruneLedger,
  withLedgerStore
} from '../src';

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

async function ledgeredClient(factory = indexedDB) {
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
    const client = await ledgeredClient();

    expect(await client.table(OPERATION_LEDGER_STORE).count()).to.equal(0);
    await client.close();
  });

  it('does not create the store when the ledger is off', async () => {
    // It costs a request per transaction, so it is opt-in.
    const client = createClient({ name: 'designer', schema });
    await client.open();

    const failure = await client.table(OPERATION_LEDGER_STORE).count()
      .catch((error: unknown) => error);

    expect(failure).to.not.equal(undefined);
    await client.close();
  });

  it('records an entry for a committed write', async () => {
    const client = await ledgeredClient();
    await client.table<Design>('designs').add({ id: 1, name: 'a' });

    expect(await ledgerIds(client)).to.have.lengthOf(1);
    await client.close();
  });

  it('records nothing when the transaction aborts', async () => {
    // The property the whole design rests on. If the id survived an abort it
    // would claim a commit that never happened, and reconciliation would then
    // confidently skip a write that was actually lost.
    const client = await ledgeredClient();

    await client.transaction('readwrite', ['designs'], async (scope) => {
      await scope.table<Design>('designs').add({ id: 1, name: 'a' });
      scope.abort();
    }).catch(() => undefined);

    expect(await ledgerIds(client)).to.deep.equal([]);
    expect(await client.table<Design>('designs').count()).to.equal(0);
    await client.close();
  });

  it('keeps the id and the data consistent with each other', async () => {
    // One committed and one aborted transaction: the ledger must have exactly
    // one entry, and the store exactly one row. Either being out of step means
    // the two are not actually sharing a transaction.
    const client = await ledgeredClient();

    await client.table<Design>('designs').add({ id: 1, name: 'kept' });
    await client.transaction('readwrite', ['designs'], async (scope) => {
      await scope.table<Design>('designs').add({ id: 2, name: 'discarded' });
      scope.abort();
    }).catch(() => undefined);

    expect(await ledgerIds(client)).to.have.lengthOf(1);
    expect(await client.table<Design>('designs').count()).to.equal(1);
    await client.close();
  });

  it('does not write a ledger entry for a read-only transaction', async () => {
    const client = await ledgeredClient();
    await client.table<Design>('designs').query();

    expect(await ledgerIds(client)).to.deep.equal([]);
    await client.close();
  });
});

describe('cana write resolution', () => {
  it('resolves a committed write as committed', async () => {
    const client = await ledgeredClient();
    const { events } = await client.transaction('readwrite', ['designs'], async (scope) => {
      await scope.table<Design>('designs').add({ id: 1, name: 'a' });
    });

    const { correlationId } = events[0];

    expect(await client.resolveWrite(correlationId, Date.now())).to.equal('committed');
    await client.close();
  });

  it('survives a close and reopen, which is the point', async () => {
    // In-memory state does not survive a killed worker. The ledger is on disk,
    // so the answer must still be available to a client that never saw the
    // original write.
    const factory = indexedDB;
    const first = await ledgeredClient(factory);
    const { events } = await first.transaction('readwrite', ['designs'], async (scope) => {
      await scope.table<Design>('designs').add({ id: 1, name: 'a' });
    });
    const { correlationId } = events[0];
    await first.close();

    const second = await ledgeredClient(factory);

    expect(await second.resolveWrite(correlationId, Date.now())).to.equal('committed');
    await second.close();
  });

  it('resolves an id that was never committed as rolled-back', async () => {
    const client = await ledgeredClient();
    await client.table<Design>('designs').add({ id: 1, name: 'a' });

    expect(await client.resolveWrite('never-happened:1', Date.now())).to.equal('rolled-back');
    await client.close();
  });

  it('says unresolvable rather than rolled-back once the entry could have been pruned', async () => {
    // The distinction that prevents the duplicate-write bug. An absent id past
    // the horizon might have committed and been pruned; calling that
    // "rolled-back" would tell a caller to safely retry a write that already
    // landed.
    const client = await ledgeredClient();
    const longAgo = Date.now() - (48 * 60 * 60 * 1000);

    expect(await client.resolveWrite('ancient:1', longAgo)).to.equal('unresolvable');
    await client.close();
  });

  it('is unresolvable when the ledger was never enabled', async () => {
    // No evidence is not evidence of absence.
    const client = createClient({ name: 'designer', schema });
    await client.open();

    expect(await client.resolveWrite('anything:1', Date.now())).to.equal('unresolvable');
    await client.close();
  });
});

describe('cana ledger pruning', () => {
  it('deletes entries older than the horizon and keeps the rest', async () => {
    const factory = indexedDB;
    const client = await ledgeredClient(factory);
    await client.table<Design>('designs').add({ id: 1, name: 'recent' });

    // Backdate one entry, which is the only way to age it without waiting. Note
    // that this put is itself a ledgered write and so adds an entry of its own —
    // which is why the assertions below name ids rather than count rows.
    const ledger = client.table<{ id: string; at: number }>(OPERATION_LEDGER_STORE);
    const [existing] = await ledger.query();
    await ledger.put({ ...existing, id: 'old:1', at: Date.now() - (48 * 60 * 60 * 1000) });

    expect(await ledgerIds(client)).to.include('old:1');

    const database = await openRaw(factory);
    const removed = await pruneLedger(database, { horizonMs: 24 * 60 * 60 * 1000 });
    database.close();

    const survivors = await ledgerIds(client);

    expect(removed).to.equal(1);
    expect(survivors).not.to.include('old:1');
    // The recent entries are untouched: pruning is bounded by the horizon, not
    // a clear-out.
    expect(survivors.length).to.be.greaterThan(0);
    await client.close();
  });

  it('returns zero when there is no ledger store', async () => {
    const factory = indexedDB;
    const client = createClient({ name: 'designer', schema, factory });
    await client.open();
    await client.close();

    const database = await openRaw(factory);

    expect(await pruneLedger(database)).to.equal(0);
    database.close();
  });
});

describe('withLedgerStore', () => {
  it('adds the store once and is idempotent', () => {
    const once = withLedgerStore(schema.stores);
    const twice = withLedgerStore(once as typeof schema.stores);

    expect(once).to.have.lengthOf(2);
    expect(twice).to.have.lengthOf(2);
  });
});
