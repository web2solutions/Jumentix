import type { CanaChangeEvent, CanaSchema } from '../src';
import { createClient, isCanaErrorCode } from '../src';
import { thrownBy } from './harness';

/**
 * Run against a real IndexedDB implementation. The claims under test here —
 * "the abort rolled the write back", "the query used its index", "the event was
 * not emitted until commit" — are all claims about engine behaviour, and a stub
 * would simply agree with whatever the engine does.
 */

interface Design {
  id: number;
  name: string;
  owner: string;
  size: number;
}

const schema: CanaSchema = {
  version: 1,
  stores: [
    {
      name: 'designs',
      keyPath: 'id',
      indexes: [
        { name: 'byOwner', keyPath: 'owner' },
        { name: 'bySize', keyPath: 'size' }
      ]
    },
    { name: 'notes', autoIncrement: true }
  ]
};

const design = (id: number, over: Partial<Design> = {}): Design => ({
  id,
  name: `design-${id}`,
  owner: 'ana',
  size: id * 10,
  ...over
});

async function openClient() {
  const client = createClient({ name: 'designer', schema });
  await client.open();
  return client;
}

describe('cana crud', () => {
  it('adds and reads a record back', async () => {
    const client = await openClient();
    const written = await client.table<Design>('designs').add(design(1));

    expect(written.outcome).to.equal('committed');
    expect(written.key).to.equal(1);
    expect(await client.table<Design>('designs').get(1)).to.deep.include({ name: 'design-1' });
    await client.close();
  });

  it('refuses a duplicate key on add but allows it on put', async () => {
    const client = await openClient();
    const table = client.table<Design>('designs');
    await table.add(design(1));

    const failure = await table.add(design(1, { name: 'clash' })).catch((error: unknown) => error);

    expect(isCanaErrorCode(failure, 'ConstraintViolation')).to.equal(true);

    await table.put(design(1, { name: 'replaced' }));

    expect(await table.get(1)).to.deep.include({ name: 'replaced' });
    await client.close();
  });

  it('distinguishes a put that created from a put that updated', async () => {
    // Subscribers act differently on the two, so collapsing them into one event
    // type would make the stream unusable for anything but invalidation.
    const client = await openClient();
    const table = client.table<Design>('designs');

    const created = await table.put(design(1));
    const updated = await table.put(design(1, { name: 'again' }));

    expect(created.events.map((event) => event.type)).to.deep.equal(['created']);
    expect(updated.events.map((event) => event.type)).to.deep.equal(['updated']);
    await client.close();
  });

  it('merges changes on update and leaves untouched fields alone', async () => {
    const client = await openClient();
    const table = client.table<Design>('designs');
    await table.add(design(1, { owner: 'ana', size: 99 }));

    await table.update(1, { name: 'renamed' });

    // `toEqual`, not `toStrictEqual`: a record read back from IndexedDB is a
    // structured clone and does not carry the realm's Object.prototype. See the
    // dedicated test below — this is a real property of the storage layer, not a
    // quirk of the shim being worked around here.
    // eslint-disable-next-line jest/prefer-strict-equal -- see the prototype test below
    expect(await table.get(1)).to.deep.equal({
      id: 1, name: 'renamed', owner: 'ana', size: 99
    });
    await client.close();
  });

  it('returns records as structured clones, without their original prototype', async () => {
    // Load-bearing for the whole contract. This is why `CanaError` is plain data
    // with a `canaError: true` discriminant rather than an Error subclass: a
    // class identity does not survive the round trip, so any `instanceof` check
    // against stored data — or against anything crossing a worker boundary —
    // would silently start returning false.
    // Asserted through a class rather than by inspecting the prototype
    // directly. Which prototype a clone lands on is an implementation detail of
    // the structured-clone algorithm — a fake implementation produced a null prototype
    // and Bun's produces Object.prototype, so an assertion phrased against
    // `Object.prototype` tests the host, not Cana. What the contract actually
    // promises is that class identity does not survive, and that is the same
    // claim in every runtime.
    class Design_ {
      readonly id = 1;

      readonly name = 'design-1';

      readonly owner = 'ana';

      readonly size = 10;

      get label(): string {
        return `${this.name} (${this.owner})`;
      }
    }

    const client = await openClient();
    const original = new Design_();
    await client.table<Design>('designs').add(original as unknown as Design);

    const read = await client.table<Design>('designs').get(1);

    // eslint-disable-next-line jest/prefer-strict-equal -- the lost identity IS the assertion
    expect(read).to.deep.equal(design(1));
    expect(original).to.be.instanceOf(Design_);
    expect(read).not.to.be.instanceOf(Design_);
    // The accessor is gone too, which is the part that bites in practice: the
    // data survives and the behaviour does not.
    expect((read as unknown as Design_).label).to.equal(undefined);
    await client.close();
  });

  it('fails an update on a missing key rather than inserting it', async () => {
    // An update that silently inserts resurrects records another tab deleted.
    const client = await openClient();
    const table = client.table<Design>('designs');

    const failure = await table.update(42, { name: 'ghost' }).catch((error: unknown) => error);

    expect(isCanaErrorCode(failure, 'NotFound')).to.equal(true);
    expect(await table.count()).to.equal(0);
    await client.close();
  });

  it('does not emit a deleted event when the key was not there', async () => {
    // IndexedDB deletes a missing key silently; announcing it anyway would tell
    // subscribers a record vanished that never existed.
    const client = await openClient();
    const removed = await client.table<Design>('designs').delete(7);

    expect(removed.events).to.deep.equal([]);
    await client.close();
  });

  it('rejects an explicit key on a store with an inbound keyPath', async () => {
    const client = await openClient();
    const failure = await client.table<Design>('designs')
      .add(design(1), 5)
      .catch((error: unknown) => error);

    expect(isCanaErrorCode(failure, 'InvalidRequest')).to.equal(true);
    expect((failure as { message: string }).message).to.include('inbound');
    await client.close();
  });

  it('generates keys for an autoIncrement outbound store', async () => {
    const client = await openClient();
    const notes = client.table<{ text: string }>('notes');

    const first = await notes.add({ text: 'one' });
    const second = await notes.add({ text: 'two' });

    expect(first.key).to.equal(1);
    expect(second.key).to.equal(2);
    await client.close();
  });
});

describe('cana bulk writes', () => {
  it('writes a batch and reports every key in input order', async () => {
    const client = await openClient();
    const result = await client.table<Design>('designs')
      .bulkAdd([design(1), design(2), design(3)]);

    expect(result.outcome).to.equal('committed');
    expect(result.keys).to.deep.equal([1, 2, 3]);
    expect(result.events).to.have.lengthOf(3);
    await client.close();
  });

  it('rolls the whole batch back when one row fails', async () => {
    // The alternative — committing rows 1..k and reporting an error — leaves the
    // caller with no way to know how far it got.
    const client = await openClient();
    const table = client.table<Design>('designs');
    await table.add(design(2));

    const failure = await table
      .bulkAdd([design(1), design(2), design(3)])
      .catch((error: unknown) => error);

    expect(isCanaErrorCode(failure, 'ConstraintViolation')).to.equal(true);
    // Only the pre-existing row survives: nothing from the batch landed.
    expect(await table.count()).to.equal(1);
    await client.close();
  });

  it('bulk deletes by key', async () => {
    const client = await openClient();
    const table = client.table<Design>('designs');
    await table.bulkAdd([design(1), design(2), design(3)]);

    const removed = await table.bulkDelete([1, 3]);

    expect(removed.keys).to.deep.equal([1, 3]);
    expect(await table.count()).to.equal(1);
    await client.close();
  });
});

describe('cana transactions', () => {
  it('commits every write in the scope together', async () => {
    const client = await openClient();

    const { outcome, events } = await client.transaction('readwrite', ['designs', 'notes'], async (scope) => {
      await scope.table<Design>('designs').add(design(1));
      await scope.table<{ text: string }>('notes').add({ text: 'linked' });
    });

    expect(outcome).to.equal('committed');
    expect(events).to.have.lengthOf(2);
    expect(await client.table<Design>('designs').count()).to.equal(1);
    await client.close();
  });

  it('rolls back everything when the body aborts', async () => {
    const client = await openClient();
    const table = client.table<Design>('designs');
    await table.add(design(1));

    const failure = await client.transaction('readwrite', ['designs'], async (scope) => {
      await scope.table<Design>('designs').add(design(2));
      await scope.table<Design>('designs').add(design(3));
      scope.abort('changed my mind');
    }).catch((error: unknown) => error);

    expect(isCanaErrorCode(failure, 'TransactionAborted')).to.equal(true);
    expect((failure as { message: string }).message).to.include('changed my mind');
    // The two writes inside the aborted scope are gone; the earlier one remains.
    expect(await table.count()).to.equal(1);
    await client.close();
  });

  it('emits no events at all for an aborted transaction', async () => {
    // The property the buffering exists for: a subscriber must never see a
    // change that was rolled back, because it cannot be told to un-see it.
    const client = await openClient();
    const seen: CanaChangeEvent[] = [];
    client.subscribe((event) => seen.push(event));

    await client.transaction('readwrite', ['designs'], async (scope) => {
      await scope.table<Design>('designs').add(design(1));
      scope.abort();
    }).catch(() => undefined);

    expect(seen).to.deep.equal([]);
    await client.close();
  });

  it('rolls back when the body throws, not just when it aborts', async () => {
    const client = await openClient();

    await client.transaction('readwrite', ['designs'], async (scope) => {
      await scope.table<Design>('designs').add(design(1));
      throw new Error('application failure');
    }).catch(() => undefined);

    expect(await client.table<Design>('designs').count()).to.equal(0);
    await client.close();
  });

  it('refuses to work before open()', async () => {
    const client = createClient({ name: 'designer', schema });

    const failure = await client.table<Design>('designs').get(1).catch((error: unknown) => error);

    expect(isCanaErrorCode(failure, 'InvalidRequest')).to.equal(true);
  });
});

describe('cana queries', () => {
  const seed = async () => {
    const client = await openClient();
    await client.table<Design>('designs').bulkAdd([
      design(1, { owner: 'ana', size: 10 }),
      design(2, { owner: 'bruno', size: 20 }),
      design(3, { owner: 'ana', size: 30 }),
      design(4, { owner: 'ana', size: 40 }),
      design(5, { owner: 'bruno', size: 50 })
    ]);
    return client;
  };

  it('reports a full scan as a full scan', async () => {
    const client = await seed();
    const { plan, records } = await client.table<Design>('designs').explain();

    expect(plan).to.deep.equal({
      store: 'designs', fullScan: true, boundedByRange: false, appliedOffsetInCursor: false
    });
    expect(records).to.have.lengthOf(5);
    await client.close();
  });

  it('uses the named index and says so', async () => {
    // The criterion that separates a real index lookup from an in-memory filter
    // that returns the same rows and collapses at scale.
    const client = await seed();
    const { plan, records } = await client.table<Design>('designs')
      .explain({ index: 'byOwner', equals: 'ana' });

    expect(plan.usedIndex).to.equal('byOwner');
    expect(plan.fullScan).to.equal(false);
    expect(plan.boundedByRange).to.equal(true);
    expect(records.map((record) => record.id).sort()).to.deep.equal([1, 3, 4]);
    await client.close();
  });

  it('applies a bounded range on an index', async () => {
    const client = await seed();
    const records = await client.table<Design>('designs')
      .query({ index: 'bySize', range: { lower: 20, upper: 40 } });

    expect(records.map((record) => record.size)).to.deep.equal([20, 30, 40]);
    await client.close();
  });

  it('honours an open upper bound', async () => {
    const client = await seed();
    const records = await client.table<Design>('designs')
      .query({ index: 'bySize', range: { lower: 20, upper: 40, upperOpen: true } });

    expect(records.map((record) => record.size)).to.deep.equal([20, 30]);
    await client.close();
  });

  it('applies offset and limit through the cursor', async () => {
    const client = await seed();
    const { plan, records } = await client.table<Design>('designs')
      .explain({ offset: 1, limit: 2 });

    expect(plan.appliedOffsetInCursor).to.equal(true);
    expect(records.map((record) => record.id)).to.deep.equal([2, 3]);
    await client.close();
  });

  it('reverses order on demand', async () => {
    const client = await seed();
    const records = await client.table<Design>('designs').query({ direction: 'prev', limit: 2 });

    expect(records.map((record) => record.id)).to.deep.equal([5, 4]);
    await client.close();
  });

  it('counts without materialising, and agrees with query when it must', async () => {
    const client = await seed();
    const table = client.table<Design>('designs');

    expect(await table.count()).to.equal(5);
    expect(await table.count({ index: 'byOwner', equals: 'ana' })).to.equal(3);
    // offset/limit are not expressible in a native count, so this path falls
    // back to the cursor — and must still agree with `query`.
    expect(await table.count({ limit: 2 })).to.equal(2);
    await client.close();
  });

  it('names the store and index when the index does not exist', async () => {
    const client = await seed();
    const failure = await client.table<Design>('designs')
      .query({ index: 'byNothing' })
      .catch((error: unknown) => error);

    expect(isCanaErrorCode(failure, 'NotFound')).to.equal(true);
    expect((failure as { store?: string }).store).to.equal('designs');
    await client.close();
  });
});

describe('cana change notification', () => {
  it('delivers to listeners in registration order', async () => {
    const client = await openClient();
    const order: string[] = [];
    client.subscribe(() => order.push('first'));
    client.subscribe(() => order.push('second'));

    await client.table<Design>('designs').add(design(1));

    expect(order).to.deep.equal(['first', 'second']);
    await client.close();
  });

  it('keeps delivering after a listener throws', async () => {
    // One broken subscriber must not become a database-wide outage reported
    // nowhere near its cause.
    const client = await openClient();
    const reached: string[] = [];
    client.subscribe(() => { throw new Error('subscriber is broken'); });
    client.subscribe(() => reached.push('still called'));

    await client.table<Design>('designs').add(design(1));

    expect(reached).to.deep.equal(['still called']);
    await client.close();
  });

  it('stops delivering after unsubscribe', async () => {
    const client = await openClient();
    const seen: CanaChangeEvent[] = [];
    const stop = client.subscribe((event) => seen.push(event));

    await client.table<Design>('designs').add(design(1));
    stop();
    await client.table<Design>('designs').add(design(2));

    expect(seen).to.have.lengthOf(1);
    await client.close();
  });

  it('assigns strictly increasing cursors across transactions', async () => {
    const client = await openClient();
    const seen: CanaChangeEvent[] = [];
    client.subscribe((event) => seen.push(event));

    await client.table<Design>('designs').add(design(1));
    await client.table<Design>('designs').add(design(2));

    expect(seen.map((event) => event.cursor)).to.deep.equal([1, 2]);
    await client.close();
  });

  it('replays from a cursor for a subscriber that arrives late', async () => {
    // What makes a restarted worker able to resume rather than either replaying
    // from zero or silently skipping what it missed.
    const client = await openClient();
    await client.table<Design>('designs').add(design(1));
    await client.table<Design>('designs').add(design(2));

    const replayed: number[] = [];
    client.subscribe((event) => replayed.push(event.cursor), { sinceCursor: 1 });

    expect(replayed).to.deep.equal([2]);
    await client.close();
  });

  it('refuses a replay it cannot serve in full', async () => {
    // Replaying what remains would look complete and quietly omit the middle.
    const client = createClient({
      name: 'designer', schema, retainedEvents: 2
    });
    await client.open();
    await client.table<Design>('designs').bulkAdd([design(1), design(2), design(3), design(4)]);

    expect(thrownBy(() => client.subscribe(() => undefined, { sinceCursor: 0 })))
      .to.deep.include({ code: 'NotFound' });
    await client.close();
  });

  it('tags every event with the same correlationId within one transaction', async () => {
    const client = await openClient();

    const { events } = await client.transaction('readwrite', ['designs'], async (scope) => {
      await scope.table<Design>('designs').add(design(1));
      await scope.table<Design>('designs').add(design(2));
    });

    expect(new Set(events.map((event) => event.correlationId)).size).to.equal(1);
    await client.close();
  });
});

describe('cana export', () => {
  it('exports every store as plain data', async () => {
    // Under the no-fallback decision this is the only recovery path a user has,
    // so it is part of the contract rather than a convenience.
    const client = await openClient();
    await client.table<Design>('designs').bulkAdd([design(1), design(2)]);
    await client.table<{ text: string }>('notes').add({ text: 'kept' });

    const dump = await client.exportAll();

    expect(Object.keys(dump).sort()).to.deep.equal(['designs', 'notes']);
    expect(dump.designs).to.have.lengthOf(2);
    // eslint-disable-next-line jest/prefer-strict-equal -- exported records are structured clones
    expect(dump.notes).to.deep.equal([{ text: 'kept' }]);
    await client.close();
  });
});
