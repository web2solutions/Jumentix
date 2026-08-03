import Dexie from 'dexie';
import type { CanaSchema } from '../src';
import { createClient } from '../src';

/**
 * Differential harness: Cana against Dexie on identical inputs (JUM-561).
 *
 * Every other suite in this package checks Cana against what I believed
 * IndexedDB does. This one checks it against an independent implementation that
 * has been in production for over a decade — which is the only kind of test that
 * can catch a belief that is wrong in the same way twice.
 *
 * Both run over the browser's own IndexedDB, each under its own database name, so the two
 * see identical storage semantics and differ only in engine.
 *
 * **Dexie is used strictly as a dev-time oracle.** No Dexie code is vendored,
 * copied, or referenced by `@jumentix/cana`; it appears only in this file and
 * only in `devDependencies`, under its own Apache-2.0 terms.
 *
 * ## Where the two are expected to differ
 *
 * Divergence is not automatically a Cana bug. Several differences are documented
 * decisions — `update` not inserting, for instance — and where they occur, the
 * test asserts the difference and says why, rather than being deleted for being
 * inconvenient.
 */

interface Design {
  id: number;
  name: string;
  owner: string;
  size: number;
}

const rows: Design[] = [
  {
    id: 1, name: 'alpha', owner: 'ana', size: 10
  },
  {
    id: 2, name: 'bravo', owner: 'bruno', size: 20
  },
  {
    id: 3, name: 'charlie', owner: 'ana', size: 30
  },
  {
    id: 4, name: 'delta', owner: 'carla', size: 40
  },
  {
    id: 5, name: 'echo', owner: 'ana', size: 50
  },
  {
    id: 6, name: 'foxtrot', owner: 'bruno', size: 60
  }
];

const schema: CanaSchema = {
  version: 1,
  stores: [{
    name: 'designs',
    keyPath: 'id',
    indexes: [
      { name: 'owner', keyPath: 'owner' },
      { name: 'size', keyPath: 'size' }
    ]
  }]
};

/** Both engines, seeded identically, each on its own factory. */
async function bothSeeded() {
  const cana = createClient({ name: 'diff-cana', schema });
  await cana.open();
  await cana.table<Design>('designs').bulkAdd(rows);

  // Dexie reads `indexedDB` from the global, so it is pointed at a fresh factory
  // explicitly rather than sharing one with Cana.
  const dexie = new Dexie('diff-dexie', { indexedDB, IDBKeyRange });
  dexie.version(1).stores({ designs: 'id, owner, size' });
  await dexie.open();
  await dexie.table<Design>('designs').bulkAdd(rows);

  return {
    cana,
    dexie,
    async teardown() {
      await cana.close();
      dexie.close();
    }
  };
}

/** Ids in a stable order, so set equality is what is being compared. */
const ids = (records: readonly Design[]): number[] => records
  .map((row) => row.id)
  .sort((a, b) => a - b);

describe('differential: reads agree with Dexie', () => {
  it('returns the same records for a full scan', async () => {
    const { cana, dexie, teardown } = await bothSeeded();

    const fromCana = await cana.table<Design>('designs').query();
    const fromDexie = await dexie.table<Design>('designs').toArray();

    expect(ids(fromCana)).to.deep.equal(ids(fromDexie));
    expect(ids(fromCana)).to.deep.equal([1, 2, 3, 4, 5, 6]);
    await teardown();
  });

  it('returns the same records for an equality lookup on an index', async () => {
    const { cana, dexie, teardown } = await bothSeeded();

    const fromCana = await cana.table<Design>('designs').query({ index: 'owner', equals: 'ana' });
    const fromDexie = await dexie.table<Design>('designs').where('owner').equals('ana').toArray();

    expect(ids(fromCana)).to.deep.equal(ids(fromDexie));
    expect(ids(fromCana)).to.deep.equal([1, 3, 5]);
    await teardown();
  });

  it('agrees on a closed range', async () => {
    const { cana, dexie, teardown } = await bothSeeded();

    const fromCana = await cana.table<Design>('designs')
      .query({ index: 'size', range: { lower: 20, upper: 50 } });
    const fromDexie = await dexie.table<Design>('designs')
      .where('size').between(20, 50, true, true).toArray();

    expect(ids(fromCana)).to.deep.equal(ids(fromDexie));
    await teardown();
  });

  it('agrees on a half-open range, which is where off-by-one bugs live', async () => {
    const { cana, dexie, teardown } = await bothSeeded();

    const fromCana = await cana.table<Design>('designs')
      .query({ index: 'size', range: { lower: 20, upper: 50, upperOpen: true } });
    const fromDexie = await dexie.table<Design>('designs')
      .where('size').between(20, 50, true, false).toArray();

    expect(ids(fromCana)).to.deep.equal(ids(fromDexie));
    expect(ids(fromCana)).to.deep.equal([2, 3, 4]);
    await teardown();
  });

  it('agrees on both bounds open', async () => {
    const { cana, dexie, teardown } = await bothSeeded();

    const fromCana = await cana.table<Design>('designs')
      .query({
        index: 'size',
        range: {
          lower: 20, upper: 50, lowerOpen: true, upperOpen: true
        }
      });
    const fromDexie = await dexie.table<Design>('designs')
      .where('size').between(20, 50, false, false).toArray();

    expect(ids(fromCana)).to.deep.equal(ids(fromDexie));
    expect(ids(fromCana)).to.deep.equal([3, 4]);
    await teardown();
  });

  it('agrees on lower-only and upper-only bounds', async () => {
    const { cana, dexie, teardown } = await bothSeeded();

    const canaAbove = await cana.table<Design>('designs')
      .query({ index: 'size', range: { lower: 40 } });
    const dexieAbove = await dexie.table<Design>('designs').where('size').aboveOrEqual(40).toArray();

    const canaBelow = await cana.table<Design>('designs')
      .query({ index: 'size', range: { upper: 30 } });
    const dexieBelow = await dexie.table<Design>('designs').where('size').belowOrEqual(30).toArray();

    expect(ids(canaAbove)).to.deep.equal(ids(dexieAbove));
    expect(ids(canaBelow)).to.deep.equal(ids(dexieBelow));
    await teardown();
  });

  it('agrees on ordering by an index, ascending and descending', async () => {
    // Order is asserted directly, not sorted first — the ordering is the claim.
    const { cana, dexie, teardown } = await bothSeeded();

    const canaAsc = await cana.table<Design>('designs').query({ index: 'size' });
    const dexieAsc = await dexie.table<Design>('designs').orderBy('size').toArray();

    const canaDesc = await cana.table<Design>('designs').query({ index: 'size', direction: 'prev' });
    const dexieDesc = await dexie.table<Design>('designs').orderBy('size').reverse().toArray();

    expect(canaAsc.map((row) => row.id)).to.deep.equal(dexieAsc.map((row) => row.id));
    expect(canaDesc.map((row) => row.id)).to.deep.equal(dexieDesc.map((row) => row.id));
    await teardown();
  });

  it('agrees on limit', async () => {
    const { cana, dexie, teardown } = await bothSeeded();

    const fromCana = await cana.table<Design>('designs').query({ index: 'size', limit: 3 });
    const fromDexie = await dexie.table<Design>('designs').orderBy('size').limit(3).toArray();

    expect(fromCana.map((row) => row.id)).to.deep.equal(fromDexie.map((row) => row.id));
    await teardown();
  });

  it('agrees on offset combined with limit', async () => {
    // Pagination is where a cursor-advance implementation and a slice-after
    // implementation diverge, so it is worth checking against another engine.
    const { cana, dexie, teardown } = await bothSeeded();

    const fromCana = await cana.table<Design>('designs')
      .query({ index: 'size', offset: 2, limit: 2 });
    const fromDexie = await dexie.table<Design>('designs')
      .orderBy('size').offset(2).limit(2)
      .toArray();

    expect(fromCana.map((row) => row.id)).to.deep.equal(fromDexie.map((row) => row.id));
    expect(fromCana.map((row) => row.id)).to.deep.equal([3, 4]);
    await teardown();
  });

  it('agrees on counts, overall and by index', async () => {
    const { cana, dexie, teardown } = await bothSeeded();

    expect(await cana.table<Design>('designs').count()).to.equal(await dexie.table<Design>('designs').count());
    expect(await cana.table<Design>('designs').count({ index: 'owner', equals: 'ana' })).to.equal(await dexie.table<Design>('designs').where('owner').equals('ana').count());
    await teardown();
  });

  it('agrees on a lookup that matches nothing', async () => {
    const { cana, dexie, teardown } = await bothSeeded();

    const fromCana = await cana.table<Design>('designs')
      .query({ index: 'owner', equals: 'nobody' });
    const fromDexie = await dexie.table<Design>('designs').where('owner').equals('nobody').toArray();

    expect(fromCana).to.deep.equal([]);
    expect(fromDexie).to.deep.equal([]);
    await teardown();
  });

  it('agrees on a get for a present and an absent key', async () => {
    const { cana, dexie, teardown } = await bothSeeded();

    const canaHit = await cana.table<Design>('designs').get(3);
    const dexieHit = await dexie.table<Design>('designs').get(3);

    expect(canaHit?.name).to.equal(dexieHit?.name);
    expect(await cana.table<Design>('designs').get(99)).to.equal(undefined);
    expect(await dexie.table<Design>('designs').get(99)).to.equal(undefined);
    await teardown();
  });
});

describe('differential: writes agree with Dexie', () => {
  it('agrees on the state after a put that replaces', async () => {
    const { cana, dexie, teardown } = await bothSeeded();

    await cana.table<Design>('designs').put({
      id: 1, name: 'replaced', owner: 'ana', size: 10
    });
    await dexie.table<Design>('designs').put({
      id: 1, name: 'replaced', owner: 'ana', size: 10
    });

    const canaRow = await cana.table<Design>('designs').get(1);
    const dexieRow = await dexie.table<Design>('designs').get(1);

    expect(canaRow?.name).to.equal(dexieRow?.name);
    expect(await cana.table<Design>('designs').count()).to.equal(await dexie.table<Design>('designs').count());
    await teardown();
  });

  it('agrees on the state after a delete', async () => {
    const { cana, dexie, teardown } = await bothSeeded();

    await cana.table<Design>('designs').delete(3);
    await dexie.table<Design>('designs').delete(3);

    const fromCana = await cana.table<Design>('designs').query();
    const fromDexie = await dexie.table<Design>('designs').toArray();

    expect(ids(fromCana)).to.deep.equal(ids(fromDexie));
    await teardown();
  });

  it('agrees that a bulk add of a duplicate key does not silently succeed', async () => {
    const { cana, dexie, teardown } = await bothSeeded();

    const canaFailed = await cana.table<Design>('designs')
      .bulkAdd([{
        id: 1, name: 'clash', owner: 'x', size: 1
      }])
      .then(() => false)
      .catch(() => true);
    const dexieFailed = await dexie.table<Design>('designs')
      .bulkAdd([{
        id: 1, name: 'clash', owner: 'x', size: 1
      }])
      .then(() => false)
      .catch(() => true);

    expect(canaFailed).to.equal(true);
    expect(dexieFailed).to.equal(true);
    await teardown();
  });

  it('agrees on the state after a clear', async () => {
    const { cana, dexie, teardown } = await bothSeeded();

    await cana.table<Design>('designs').clear();
    await dexie.table<Design>('designs').clear();

    expect(await cana.table<Design>('designs').count()).to.equal(0);
    expect(await dexie.table<Design>('designs').count()).to.equal(0);
    await teardown();
  });
});

describe('differential: documented divergences', () => {
  it('cana refuses an update on a missing key where Dexie reports zero changes', async () => {
    // A real, intended difference. Dexie's `update` returns 0 for "nothing
    // matched"; Cana throws NotFound.
    //
    // The reason is recorded in the design doc: a caller who ignores the return
    // value — which is the common case — cannot tell a no-op from a success, and
    // an update silently doing nothing is how a stale key becomes lost work.
    // Failing loudly is the decision, and this test pins it rather than letting
    // the divergence look accidental.
    const { cana, dexie, teardown } = await bothSeeded();

    const dexieResult = await dexie.table<Design>('designs').update(99, { name: 'ghost' });
    const canaFailed = await cana.table<Design>('designs')
      .update(99, { name: 'ghost' })
      .then(() => false)
      .catch(() => true);

    expect(dexieResult).to.equal(0);
    expect(canaFailed).to.equal(true);

    // Both agree on the thing that actually matters: nothing was written.
    expect(await cana.table<Design>('designs').count()).to.equal(await dexie.table<Design>('designs').count());
    expect(await cana.table<Design>('designs').get(99)).to.equal(undefined);
    await teardown();
  });

  it('both agree on an update that does match', async () => {
    // The divergence above is confined to the missing-key case; the ordinary
    // path must still agree, or the difference would be a bug rather than a
    // decision.
    const { cana, dexie, teardown } = await bothSeeded();

    await cana.table<Design>('designs').update(2, { name: 'renamed' });
    await dexie.table<Design>('designs').update(2, { name: 'renamed' });

    const canaRow = await cana.table<Design>('designs').get(2);
    const dexieRow = await dexie.table<Design>('designs').get(2);

    expect(canaRow).to.deep.equal(dexieRow);
    await teardown();
  });
});
