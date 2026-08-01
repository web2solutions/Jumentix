import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import type { CanaChangeEvent, CanaSchema } from '@jumentix/cana';
import { createClient, isCanaErrorCode } from '@jumentix/cana';

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
  const client = createClient({ name: 'designer', schema, factory: new IDBFactory() });
  await client.open();
  return client;
}

describe('cana crud', () => {
  it('adds and reads a record back', async () => {
    expect.hasAssertions();
    const client = await openClient();
    const written = await client.table<Design>('designs').add(design(1));

    expect(written.outcome).toBe('committed');
    expect(written.key).toBe(1);
    await expect(client.table<Design>('designs').get(1)).resolves.toMatchObject({ name: 'design-1' });
    await client.close();
  });

  it('refuses a duplicate key on add but allows it on put', async () => {
    expect.hasAssertions();
    const client = await openClient();
    const table = client.table<Design>('designs');
    await table.add(design(1));

    const failure = await table.add(design(1, { name: 'clash' })).catch((error: unknown) => error);

    expect(isCanaErrorCode(failure, 'ConstraintViolation')).toBe(true);

    await table.put(design(1, { name: 'replaced' }));

    await expect(table.get(1)).resolves.toMatchObject({ name: 'replaced' });
    await client.close();
  });

  it('distinguishes a put that created from a put that updated', async () => {
    expect.hasAssertions();
    // Subscribers act differently on the two, so collapsing them into one event
    // type would make the stream unusable for anything but invalidation.
    const client = await openClient();
    const table = client.table<Design>('designs');

    const created = await table.put(design(1));
    const updated = await table.put(design(1, { name: 'again' }));

    expect(created.events.map((event) => event.type)).toStrictEqual(['created']);
    expect(updated.events.map((event) => event.type)).toStrictEqual(['updated']);
    await client.close();
  });

  it('merges changes on update and leaves untouched fields alone', async () => {
    expect.hasAssertions();
    const client = await openClient();
    const table = client.table<Design>('designs');
    await table.add(design(1, { owner: 'ana', size: 99 }));

    await table.update(1, { name: 'renamed' });

    // `toEqual`, not `toStrictEqual`: a record read back from IndexedDB is a
    // structured clone and does not carry the realm's Object.prototype. See the
    // dedicated test below — this is a real property of the storage layer, not a
    // quirk of the shim being worked around here.
    // eslint-disable-next-line jest/prefer-strict-equal -- see the prototype test below
    await expect(table.get(1)).resolves.toEqual({
      id: 1, name: 'renamed', owner: 'ana', size: 99
    });
    await client.close();
  });

  it('returns records as structured clones, without their original prototype', async () => {
    expect.hasAssertions();
    // Load-bearing for the whole contract. This is why `CanaError` is plain data
    // with a `canaError: true` discriminant rather than an Error subclass: a
    // class identity does not survive the round trip, so any `instanceof` check
    // against stored data — or against anything crossing a worker boundary —
    // would silently start returning false.
    // Asserted through a class rather than by inspecting the prototype
    // directly. Which prototype a clone lands on is an implementation detail of
    // the structured-clone algorithm — fake-indexeddb produces a null prototype
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
    expect(read).toEqual(design(1));
    expect(original).toBeInstanceOf(Design_);
    expect(read).not.toBeInstanceOf(Design_);
    // The accessor is gone too, which is the part that bites in practice: the
    // data survives and the behaviour does not.
    expect((read as unknown as Design_).label).toBeUndefined();
    await client.close();
  });

  it('fails an update on a missing key rather than inserting it', async () => {
    expect.hasAssertions();
    // An update that silently inserts resurrects records another tab deleted.
    const client = await openClient();
    const table = client.table<Design>('designs');

    const failure = await table.update(42, { name: 'ghost' }).catch((error: unknown) => error);

    expect(isCanaErrorCode(failure, 'NotFound')).toBe(true);
    await expect(table.count()).resolves.toBe(0);
    await client.close();
  });

  it('does not emit a deleted event when the key was not there', async () => {
    expect.hasAssertions();
    // IndexedDB deletes a missing key silently; announcing it anyway would tell
    // subscribers a record vanished that never existed.
    const client = await openClient();
    const removed = await client.table<Design>('designs').delete(7);

    expect(removed.events).toStrictEqual([]);
    await client.close();
  });

  it('rejects an explicit key on a store with an inbound keyPath', async () => {
    expect.hasAssertions();
    const client = await openClient();
    const failure = await client.table<Design>('designs')
      .add(design(1), 5)
      .catch((error: unknown) => error);

    expect(isCanaErrorCode(failure, 'InvalidRequest')).toBe(true);
    expect((failure as { message: string }).message).toContain('inbound');
    await client.close();
  });

  it('generates keys for an autoIncrement outbound store', async () => {
    expect.hasAssertions();
    const client = await openClient();
    const notes = client.table<{ text: string }>('notes');

    const first = await notes.add({ text: 'one' });
    const second = await notes.add({ text: 'two' });

    expect(first.key).toBe(1);
    expect(second.key).toBe(2);
    await client.close();
  });
});

describe('cana bulk writes', () => {
  it('writes a batch and reports every key in input order', async () => {
    expect.hasAssertions();
    const client = await openClient();
    const result = await client.table<Design>('designs')
      .bulkAdd([design(1), design(2), design(3)]);

    expect(result.outcome).toBe('committed');
    expect(result.keys).toStrictEqual([1, 2, 3]);
    expect(result.events).toHaveLength(3);
    await client.close();
  });

  it('rolls the whole batch back when one row fails', async () => {
    expect.hasAssertions();
    // The alternative — committing rows 1..k and reporting an error — leaves the
    // caller with no way to know how far it got.
    const client = await openClient();
    const table = client.table<Design>('designs');
    await table.add(design(2));

    const failure = await table
      .bulkAdd([design(1), design(2), design(3)])
      .catch((error: unknown) => error);

    expect(isCanaErrorCode(failure, 'ConstraintViolation')).toBe(true);
    // Only the pre-existing row survives: nothing from the batch landed.
    await expect(table.count()).resolves.toBe(1);
    await client.close();
  });

  it('bulk deletes by key', async () => {
    expect.hasAssertions();
    const client = await openClient();
    const table = client.table<Design>('designs');
    await table.bulkAdd([design(1), design(2), design(3)]);

    const removed = await table.bulkDelete([1, 3]);

    expect(removed.keys).toStrictEqual([1, 3]);
    await expect(table.count()).resolves.toBe(1);
    await client.close();
  });
});

describe('cana transactions', () => {
  it('commits every write in the scope together', async () => {
    expect.hasAssertions();
    const client = await openClient();

    const { outcome, events } = await client.transaction('readwrite', ['designs', 'notes'], async (scope) => {
      await scope.table<Design>('designs').add(design(1));
      await scope.table<{ text: string }>('notes').add({ text: 'linked' });
    });

    expect(outcome).toBe('committed');
    expect(events).toHaveLength(2);
    await expect(client.table<Design>('designs').count()).resolves.toBe(1);
    await client.close();
  });

  it('rolls back everything when the body aborts', async () => {
    expect.hasAssertions();
    const client = await openClient();
    const table = client.table<Design>('designs');
    await table.add(design(1));

    const failure = await client.transaction('readwrite', ['designs'], async (scope) => {
      await scope.table<Design>('designs').add(design(2));
      await scope.table<Design>('designs').add(design(3));
      scope.abort('changed my mind');
    }).catch((error: unknown) => error);

    expect(isCanaErrorCode(failure, 'TransactionAborted')).toBe(true);
    expect((failure as { message: string }).message).toContain('changed my mind');
    // The two writes inside the aborted scope are gone; the earlier one remains.
    await expect(table.count()).resolves.toBe(1);
    await client.close();
  });

  it('emits no events at all for an aborted transaction', async () => {
    expect.hasAssertions();
    // The property the buffering exists for: a subscriber must never see a
    // change that was rolled back, because it cannot be told to un-see it.
    const client = await openClient();
    const seen: CanaChangeEvent[] = [];
    client.subscribe((event) => seen.push(event));

    await client.transaction('readwrite', ['designs'], async (scope) => {
      await scope.table<Design>('designs').add(design(1));
      scope.abort();
    }).catch(() => undefined);

    expect(seen).toStrictEqual([]);
    await client.close();
  });

  it('rolls back when the body throws, not just when it aborts', async () => {
    expect.hasAssertions();
    const client = await openClient();

    await client.transaction('readwrite', ['designs'], async (scope) => {
      await scope.table<Design>('designs').add(design(1));
      throw new Error('application failure');
    }).catch(() => undefined);

    await expect(client.table<Design>('designs').count()).resolves.toBe(0);
    await client.close();
  });

  it('refuses to work before open()', async () => {
    expect.hasAssertions();
    const client = createClient({ name: 'designer', schema, factory: new IDBFactory() });

    const failure = await client.table<Design>('designs').get(1).catch((error: unknown) => error);

    expect(isCanaErrorCode(failure, 'InvalidRequest')).toBe(true);
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
    expect.hasAssertions();
    const client = await seed();
    const { plan, records } = await client.table<Design>('designs').explain();

    expect(plan).toStrictEqual({
      store: 'designs', fullScan: true, boundedByRange: false, appliedOffsetInCursor: false
    });
    expect(records).toHaveLength(5);
    await client.close();
  });

  it('uses the named index and says so', async () => {
    expect.hasAssertions();
    // The criterion that separates a real index lookup from an in-memory filter
    // that returns the same rows and collapses at scale.
    const client = await seed();
    const { plan, records } = await client.table<Design>('designs')
      .explain({ index: 'byOwner', equals: 'ana' });

    expect(plan.usedIndex).toBe('byOwner');
    expect(plan.fullScan).toBe(false);
    expect(plan.boundedByRange).toBe(true);
    expect(records.map((record) => record.id).sort()).toStrictEqual([1, 3, 4]);
    await client.close();
  });

  it('applies a bounded range on an index', async () => {
    expect.hasAssertions();
    const client = await seed();
    const records = await client.table<Design>('designs')
      .query({ index: 'bySize', range: { lower: 20, upper: 40 } });

    expect(records.map((record) => record.size)).toStrictEqual([20, 30, 40]);
    await client.close();
  });

  it('honours an open upper bound', async () => {
    expect.hasAssertions();
    const client = await seed();
    const records = await client.table<Design>('designs')
      .query({ index: 'bySize', range: { lower: 20, upper: 40, upperOpen: true } });

    expect(records.map((record) => record.size)).toStrictEqual([20, 30]);
    await client.close();
  });

  it('applies offset and limit through the cursor', async () => {
    expect.hasAssertions();
    const client = await seed();
    const { plan, records } = await client.table<Design>('designs')
      .explain({ offset: 1, limit: 2 });

    expect(plan.appliedOffsetInCursor).toBe(true);
    expect(records.map((record) => record.id)).toStrictEqual([2, 3]);
    await client.close();
  });

  it('reverses order on demand', async () => {
    expect.hasAssertions();
    const client = await seed();
    const records = await client.table<Design>('designs').query({ direction: 'prev', limit: 2 });

    expect(records.map((record) => record.id)).toStrictEqual([5, 4]);
    await client.close();
  });

  it('counts without materialising, and agrees with query when it must', async () => {
    expect.hasAssertions();
    const client = await seed();
    const table = client.table<Design>('designs');

    await expect(table.count()).resolves.toBe(5);
    await expect(table.count({ index: 'byOwner', equals: 'ana' })).resolves.toBe(3);
    // offset/limit are not expressible in a native count, so this path falls
    // back to the cursor — and must still agree with `query`.
    await expect(table.count({ limit: 2 })).resolves.toBe(2);
    await client.close();
  });

  it('names the store and index when the index does not exist', async () => {
    expect.hasAssertions();
    const client = await seed();
    const failure = await client.table<Design>('designs')
      .query({ index: 'byNothing' })
      .catch((error: unknown) => error);

    expect(isCanaErrorCode(failure, 'NotFound')).toBe(true);
    expect((failure as { store?: string }).store).toBe('designs');
    await client.close();
  });
});

describe('cana change notification', () => {
  it('delivers to listeners in registration order', async () => {
    expect.hasAssertions();
    const client = await openClient();
    const order: string[] = [];
    client.subscribe(() => order.push('first'));
    client.subscribe(() => order.push('second'));

    await client.table<Design>('designs').add(design(1));

    expect(order).toStrictEqual(['first', 'second']);
    await client.close();
  });

  it('keeps delivering after a listener throws', async () => {
    expect.hasAssertions();
    // One broken subscriber must not become a database-wide outage reported
    // nowhere near its cause.
    const client = await openClient();
    const reached: string[] = [];
    client.subscribe(() => { throw new Error('subscriber is broken'); });
    client.subscribe(() => reached.push('still called'));

    await client.table<Design>('designs').add(design(1));

    expect(reached).toStrictEqual(['still called']);
    await client.close();
  });

  it('stops delivering after unsubscribe', async () => {
    expect.hasAssertions();
    const client = await openClient();
    const seen: CanaChangeEvent[] = [];
    const stop = client.subscribe((event) => seen.push(event));

    await client.table<Design>('designs').add(design(1));
    stop();
    await client.table<Design>('designs').add(design(2));

    expect(seen).toHaveLength(1);
    await client.close();
  });

  it('assigns strictly increasing cursors across transactions', async () => {
    expect.hasAssertions();
    const client = await openClient();
    const seen: CanaChangeEvent[] = [];
    client.subscribe((event) => seen.push(event));

    await client.table<Design>('designs').add(design(1));
    await client.table<Design>('designs').add(design(2));

    expect(seen.map((event) => event.cursor)).toStrictEqual([1, 2]);
    await client.close();
  });

  it('replays from a cursor for a subscriber that arrives late', async () => {
    expect.hasAssertions();
    // What makes a restarted worker able to resume rather than either replaying
    // from zero or silently skipping what it missed.
    const client = await openClient();
    await client.table<Design>('designs').add(design(1));
    await client.table<Design>('designs').add(design(2));

    const replayed: number[] = [];
    client.subscribe((event) => replayed.push(event.cursor), { sinceCursor: 1 });

    expect(replayed).toStrictEqual([2]);
    await client.close();
  });

  it('refuses a replay it cannot serve in full', async () => {
    expect.hasAssertions();
    // Replaying what remains would look complete and quietly omit the middle.
    const client = createClient({
      name: 'designer', schema, factory: new IDBFactory(), retainedEvents: 2
    });
    await client.open();
    await client.table<Design>('designs').bulkAdd([design(1), design(2), design(3), design(4)]);

    expect(() => client.subscribe(() => undefined, { sinceCursor: 0 }))
      .toThrow(expect.objectContaining({ code: 'NotFound' }));
    await client.close();
  });

  it('tags every event with the same correlationId within one transaction', async () => {
    expect.hasAssertions();
    const client = await openClient();

    const { events } = await client.transaction('readwrite', ['designs'], async (scope) => {
      await scope.table<Design>('designs').add(design(1));
      await scope.table<Design>('designs').add(design(2));
    });

    expect(new Set(events.map((event) => event.correlationId)).size).toBe(1);
    await client.close();
  });
});

describe('cana export', () => {
  it('exports every store as plain data', async () => {
    expect.hasAssertions();
    // Under the no-fallback decision this is the only recovery path a user has,
    // so it is part of the contract rather than a convenience.
    const client = await openClient();
    await client.table<Design>('designs').bulkAdd([design(1), design(2)]);
    await client.table<{ text: string }>('notes').add({ text: 'kept' });

    const dump = await client.exportAll();

    expect(Object.keys(dump).sort()).toStrictEqual(['designs', 'notes']);
    expect(dump.designs).toHaveLength(2);
    // eslint-disable-next-line jest/prefer-strict-equal -- exported records are structured clones
    expect(dump.notes).toEqual([{ text: 'kept' }]);
    await client.close();
  });
});
