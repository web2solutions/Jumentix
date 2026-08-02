import type { CanaChangeEvent, CanaHooks, CanaSchema } from '../src';
import { createClient, isCanaErrorCode } from '../src';

/**
 * The hook contract is mostly a set of things a hook is *not* allowed to do, so
 * most of these tests assert an absence: it cannot swallow a failure, it cannot
 * rewrite what subscribers see, and it cannot take a commit back.
 */

interface Design {
  id: number;
  name: string;
  stamped?: string;
}

const schema: CanaSchema = {
  version: 1,
  stores: [{ name: 'designs', keyPath: 'id' }]
};

async function openWith(hooks: CanaHooks, factory: IDBFactory = indexedDB) {
  const client = createClient({
    name: 'designer', schema, factory, hooks
  });
  await client.open();
  return client;
}

describe('cana write hooks', () => {
  it('transforms the record that is actually written', async () => {
    // The canonical use: stamping a field on the way in. It must land on disk,
    // not be reconciled afterwards.
    const client = await openWith({
      beforeWrite: (context) => ({ ...(context.record as Design), stamped: 'yes' })
    });

    await client.table<Design>('designs').add({ id: 1, name: 'a' });

    expect(await client.table<Design>('designs').get(1)).to.deep.include({ id: 1, name: 'a', stamped: 'yes' });
    await client.close();
  });

  it('leaves the record alone when the hook returns nothing', async () => {
    // A hook that forgets to return must not blank the record — which is what
    // taking the return value unconditionally would do.
    const client = await openWith({ beforeWrite: () => undefined });

    await client.table<Design>('designs').add({ id: 1, name: 'intact' });

    expect(await client.table<Design>('designs').get(1)).to.deep.include({ name: 'intact' });
    await client.close();
  });

  it('vetoes the write when the hook throws, and nothing is written', async () => {
    // The emptiness check must run against the *same* factory — a fresh one
    // would be a different database and would report zero regardless.
    const factory = indexedDB;
    const client = await openWith({
      beforeWrite: () => { throw new Error('not allowed'); }
    }, factory);

    const failure = await client.table<Design>('designs')
      .add({ id: 1, name: 'a' })
      .catch((error: unknown) => error);

    expect(failure).to.not.equal(undefined);
    await client.close();

    const plain = createClient({ name: 'designer', schema, factory });
    await plain.open();
    expect(await plain.table<Design>('designs').count()).to.equal(0);
    await plain.close();
  });

  it('would notice if the veto did not work', async () => {
    // The control for the test above: the same shape, with a hook that permits
    // the write. If this reported zero too, the emptiness assertion there would
    // be proving nothing.
    const factory = indexedDB;
    const client = await openWith({ beforeWrite: () => undefined }, factory);
    await client.table<Design>('designs').add({ id: 1, name: 'a' });
    await client.close();

    const plain = createClient({ name: 'designer', schema, factory });
    await plain.open();
    expect(await plain.table<Design>('designs').count()).to.equal(1);
    await plain.close();
  });

  it('rejects a hook that returns a promise instead of silently storing it', async () => {
    // The signature forbids this; JavaScript callers have no compiler. Awaiting
    // would already have cost the transaction, so it fails clearly rather than
    // writing a Promise object into the store.
    const client = await openWith({
      beforeWrite: () => Promise.resolve({ id: 1, name: 'async' }) as unknown as Design
    });

    const failure = await client.table<Design>('designs')
      .add({ id: 1, name: 'a' })
      .catch((error: unknown) => error);

    expect(isCanaErrorCode(failure, 'InvalidRequest')).to.equal(true);
    expect((failure as { message: string }).message).to.include('must be synchronous');
    await client.close();
  });

  it('runs on every write type, including bulk', async () => {
    const seen: string[] = [];
    const client = await openWith({
      beforeWrite: (context) => { seen.push(`${context.type}:${context.store}`); }
    });

    const table = client.table<Design>('designs');
    await table.add({ id: 1, name: 'a' });
    await table.put({ id: 1, name: 'b' });
    await table.update(1, { name: 'c' });
    await table.bulkAdd([{ id: 2, name: 'd' }, { id: 3, name: 'e' }]);

    expect(seen).to.deep.equal([
      'created:designs',
      'updated:designs',
      'updated:designs',
      'created:designs',
      'created:designs'
    ]);
    await client.close();
  });

  it('does not run beforeWrite for a delete, which carries no record', async () => {
    const seen: string[] = [];
    const client = await openWith({
      beforeWrite: (context) => { seen.push(context.type); }
    });

    const table = client.table<Design>('designs');
    await table.add({ id: 1, name: 'a' });
    seen.length = 0;
    await table.delete(1);

    expect(seen).to.deep.equal([]);
    await client.close();
  });
});

describe('cana commit hooks', () => {
  it('reports the committed events after durability', async () => {
    const committed: CanaChangeEvent[][] = [];
    const client = await openWith({ afterCommit: (events) => committed.push([...events]) });

    await client.table<Design>('designs').add({ id: 1, name: 'a' });

    expect(committed).to.have.lengthOf(1);
    expect(committed[0][0]).to.deep.include({ type: 'created', store: 'designs' });
    await client.close();
  });

  it('gives afterCommit frozen events it cannot rewrite for anyone else', async () => {
    // A hook that could mutate the event would be rewriting history for every
    // subscriber that had not run yet.
    const seenBySubscriber: CanaChangeEvent[] = [];
    let frozen: boolean | undefined;

    const client = await openWith({
      afterCommit: (events) => { frozen = Object.isFrozen(events[0]); }
    });
    client.subscribe((event) => seenBySubscriber.push(event));

    await client.table<Design>('designs').add({ id: 1, name: 'a' });

    expect(frozen).to.equal(true);
    expect(seenBySubscriber[0].type).to.equal('created');
    await client.close();
  });

  it('does not fail the write when afterCommit throws', async () => {
    // The data is already on disk. Reporting a failure here would be a lie about
    // durability in the direction that causes duplicate writes on retry.
    const client = await openWith({
      afterCommit: () => { throw new Error('reporting is broken'); }
    });

    const written = await client.table<Design>('designs').add({ id: 1, name: 'a' });

    expect(written.outcome).to.equal('committed');
    expect(await client.table<Design>('designs').count()).to.equal(1);
    await client.close();
  });

  it('does not call afterCommit when the transaction aborted', async () => {
    let called = false;
    const client = await openWith({ afterCommit: () => { called = true; } });

    await client.transaction('readwrite', ['designs'], async (scope) => {
      await scope.table<Design>('designs').add({ id: 1, name: 'a' });
      scope.abort();
    }).catch(() => undefined);

    expect(called).to.equal(false);
    await client.close();
  });

  it('calls afterRollback with rolled-back when the transaction aborted', async () => {
    const outcomes: string[] = [];
    const client = await openWith({ afterRollback: (outcome) => outcomes.push(outcome) });

    await client.transaction('readwrite', ['designs'], async (scope) => {
      await scope.table<Design>('designs').add({ id: 1, name: 'a' });
      scope.abort('deliberate');
    }).catch(() => undefined);

    expect(outcomes).to.deep.equal(['rolled-back']);
    await client.close();
  });

  it('does not let a throwing afterRollback mask the original failure', async () => {
    const client = await openWith({
      afterRollback: () => { throw new Error('hook is broken too'); }
    });

    const failure = await client.transaction('readwrite', ['designs'], async (scope) => {
      await scope.table<Design>('designs').add({ id: 1, name: 'a' });
      scope.abort('the real reason');
    }).catch((error: unknown) => error);

    expect(isCanaErrorCode(failure, 'TransactionAborted')).to.equal(true);
    expect((failure as { message: string }).message).to.include('the real reason');
    await client.close();
  });
});

/*
 * NOT COVERED:
 *
 * `afterRollback('unknown')`. Reaching it needs a transaction that auto-commits
 * while its body is still failing — a torn-down worker or a closed tab — which
 * is not reachable in-process. The branch exists and is typed; it is JUM-559 and
 * JUM-411 that will be able to exercise it.
 */
