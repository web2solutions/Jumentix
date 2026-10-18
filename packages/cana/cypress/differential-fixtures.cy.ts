import type { CanaSchema } from '../src';
import { createClient } from '../src';
import { uniqueName } from './harness';

/**
 * Differential harness: golden fixtures + dual-Cana agreement (JUM-561 / JUM-938).
 *
 * Two independent Cana clients open on the browser's own IndexedDB under
 * distinct database names. The same seed and the same operation sequence are
 * applied to both; results must match each other and the frozen expected
 * tables derived from that seed. No third-party engine is involved.
 *
 * Documented Cana decisions (for example `update` on a missing key) are pinned
 * as pure Cana behaviour, not as a comparison to another product.
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

/** Two Cana clients, seeded identically, each on its own database name. */
async function bothSeeded() {
  const left = createClient({ name: uniqueName('diff-a'), schema });
  const right = createClient({ name: uniqueName('diff-b'), schema });
  await left.open();
  await right.open();
  await left.table<Design>('designs').bulkAdd(rows);
  await right.table<Design>('designs').bulkAdd(rows);

  return {
    left,
    right,
    async teardown() {
      await left.close();
      await right.close();
    }
  };
}

/** Ids in a stable order, so set equality is what is being compared. */
const ids = (records: readonly Design[]): number[] => records
  .map((row) => row.id)
  .sort((a, b) => a - b);

describe('differential: reads agree across dual Cana + fixtures', () => {
  it('returns the same records for a full scan', async () => {
    const { left, right, teardown } = await bothSeeded();

    const fromLeft = await left.table<Design>('designs').query();
    const fromRight = await right.table<Design>('designs').query();

    expect(ids(fromLeft)).to.deep.equal(ids(fromRight));
    expect(ids(fromLeft)).to.deep.equal([1, 2, 3, 4, 5, 6]);
    await teardown();
  });

  it('returns the same records for an equality lookup on an index', async () => {
    const { left, right, teardown } = await bothSeeded();

    const fromLeft = await left.table<Design>('designs').query({ index: 'owner', equals: 'ana' });
    const fromRight = await right.table<Design>('designs').query({ index: 'owner', equals: 'ana' });

    expect(ids(fromLeft)).to.deep.equal(ids(fromRight));
    expect(ids(fromLeft)).to.deep.equal([1, 3, 5]);
    await teardown();
  });

  it('agrees on a closed range', async () => {
    const { left, right, teardown } = await bothSeeded();
    const range = { index: 'size' as const, range: { lower: 20, upper: 50 } };

    const fromLeft = await left.table<Design>('designs').query(range);
    const fromRight = await right.table<Design>('designs').query(range);

    expect(ids(fromLeft)).to.deep.equal(ids(fromRight));
    expect(ids(fromLeft)).to.deep.equal([2, 3, 4, 5]);
    await teardown();
  });

  it('agrees on a half-open range, which is where off-by-one bugs live', async () => {
    const { left, right, teardown } = await bothSeeded();
    const range = {
      index: 'size' as const,
      range: { lower: 20, upper: 50, upperOpen: true }
    };

    const fromLeft = await left.table<Design>('designs').query(range);
    const fromRight = await right.table<Design>('designs').query(range);

    expect(ids(fromLeft)).to.deep.equal(ids(fromRight));
    expect(ids(fromLeft)).to.deep.equal([2, 3, 4]);
    await teardown();
  });

  it('agrees on both bounds open', async () => {
    const { left, right, teardown } = await bothSeeded();
    const range = {
      index: 'size' as const,
      range: {
        lower: 20, upper: 50, lowerOpen: true, upperOpen: true
      }
    };

    const fromLeft = await left.table<Design>('designs').query(range);
    const fromRight = await right.table<Design>('designs').query(range);

    expect(ids(fromLeft)).to.deep.equal(ids(fromRight));
    expect(ids(fromLeft)).to.deep.equal([3, 4]);
    await teardown();
  });

  it('agrees on lower-only and upper-only bounds', async () => {
    const { left, right, teardown } = await bothSeeded();

    const leftAbove = await left.table<Design>('designs')
      .query({ index: 'size', range: { lower: 40 } });
    const rightAbove = await right.table<Design>('designs')
      .query({ index: 'size', range: { lower: 40 } });

    const leftBelow = await left.table<Design>('designs')
      .query({ index: 'size', range: { upper: 30 } });
    const rightBelow = await right.table<Design>('designs')
      .query({ index: 'size', range: { upper: 30 } });

    expect(ids(leftAbove)).to.deep.equal(ids(rightAbove));
    expect(ids(leftBelow)).to.deep.equal(ids(rightBelow));
    expect(ids(leftAbove)).to.deep.equal([4, 5, 6]);
    expect(ids(leftBelow)).to.deep.equal([1, 2, 3]);
    await teardown();
  });

  it('agrees on ordering by an index, ascending and descending', async () => {
    const { left, right, teardown } = await bothSeeded();

    const leftAsc = await left.table<Design>('designs').query({ index: 'size' });
    const rightAsc = await right.table<Design>('designs').query({ index: 'size' });

    const leftDesc = await left.table<Design>('designs').query({ index: 'size', direction: 'prev' });
    const rightDesc = await right.table<Design>('designs').query({ index: 'size', direction: 'prev' });

    expect(leftAsc.map((row) => row.id)).to.deep.equal(rightAsc.map((row) => row.id));
    expect(leftDesc.map((row) => row.id)).to.deep.equal(rightDesc.map((row) => row.id));
    expect(leftAsc.map((row) => row.id)).to.deep.equal([1, 2, 3, 4, 5, 6]);
    expect(leftDesc.map((row) => row.id)).to.deep.equal([6, 5, 4, 3, 2, 1]);
    await teardown();
  });

  it('agrees on limit', async () => {
    const { left, right, teardown } = await bothSeeded();

    const fromLeft = await left.table<Design>('designs').query({ index: 'size', limit: 3 });
    const fromRight = await right.table<Design>('designs').query({ index: 'size', limit: 3 });

    expect(fromLeft.map((row) => row.id)).to.deep.equal(fromRight.map((row) => row.id));
    expect(fromLeft.map((row) => row.id)).to.deep.equal([1, 2, 3]);
    await teardown();
  });

  it('agrees on offset combined with limit', async () => {
    const { left, right, teardown } = await bothSeeded();
    const page = { index: 'size' as const, offset: 2, limit: 2 };

    const fromLeft = await left.table<Design>('designs').query(page);
    const fromRight = await right.table<Design>('designs').query(page);

    expect(fromLeft.map((row) => row.id)).to.deep.equal(fromRight.map((row) => row.id));
    expect(fromLeft.map((row) => row.id)).to.deep.equal([3, 4]);
    await teardown();
  });

  it('agrees on counts, overall and by index', async () => {
    const { left, right, teardown } = await bothSeeded();

    expect(await left.table<Design>('designs').count())
      .to.equal(await right.table<Design>('designs').count());
    expect(await left.table<Design>('designs').count({ index: 'owner', equals: 'ana' }))
      .to.equal(await right.table<Design>('designs').count({ index: 'owner', equals: 'ana' }));
    expect(await left.table<Design>('designs').count()).to.equal(6);
    expect(await left.table<Design>('designs').count({ index: 'owner', equals: 'ana' })).to.equal(3);
    await teardown();
  });

  it('agrees on a lookup that matches nothing', async () => {
    const { left, right, teardown } = await bothSeeded();

    const fromLeft = await left.table<Design>('designs')
      .query({ index: 'owner', equals: 'nobody' });
    const fromRight = await right.table<Design>('designs')
      .query({ index: 'owner', equals: 'nobody' });

    expect(fromLeft).to.deep.equal([]);
    expect(fromRight).to.deep.equal([]);
    await teardown();
  });

  it('agrees on a get for a present and an absent key', async () => {
    const { left, right, teardown } = await bothSeeded();

    const leftHit = await left.table<Design>('designs').get(3);
    const rightHit = await right.table<Design>('designs').get(3);

    expect(leftHit?.name).to.equal(rightHit?.name);
    expect(leftHit?.name).to.equal('charlie');
    expect(await left.table<Design>('designs').get(99)).to.equal(undefined);
    expect(await right.table<Design>('designs').get(99)).to.equal(undefined);
    await teardown();
  });
});

describe('differential: writes agree across dual Cana', () => {
  it('agrees on the state after a put that replaces', async () => {
    const { left, right, teardown } = await bothSeeded();
    const replacement = {
      id: 1, name: 'replaced', owner: 'ana', size: 10
    };

    await left.table<Design>('designs').put(replacement);
    await right.table<Design>('designs').put(replacement);

    const leftRow = await left.table<Design>('designs').get(1);
    const rightRow = await right.table<Design>('designs').get(1);

    expect(leftRow?.name).to.equal(rightRow?.name);
    expect(leftRow?.name).to.equal('replaced');
    expect(await left.table<Design>('designs').count())
      .to.equal(await right.table<Design>('designs').count());
    await teardown();
  });

  it('agrees on the state after a delete', async () => {
    const { left, right, teardown } = await bothSeeded();

    await left.table<Design>('designs').delete(3);
    await right.table<Design>('designs').delete(3);

    const fromLeft = await left.table<Design>('designs').query();
    const fromRight = await right.table<Design>('designs').query();

    expect(ids(fromLeft)).to.deep.equal(ids(fromRight));
    expect(ids(fromLeft)).to.deep.equal([1, 2, 4, 5, 6]);
    await teardown();
  });

  it('agrees that a bulk add of a duplicate key does not silently succeed', async () => {
    const { left, right, teardown } = await bothSeeded();
    const clash = [{
      id: 1, name: 'clash', owner: 'x', size: 1
    }];

    const leftFailed = await left.table<Design>('designs')
      .bulkAdd(clash)
      .then(() => false)
      .catch(() => true);
    const rightFailed = await right.table<Design>('designs')
      .bulkAdd(clash)
      .then(() => false)
      .catch(() => true);

    expect(leftFailed).to.equal(true);
    expect(rightFailed).to.equal(true);
    await teardown();
  });

  it('agrees on the state after a clear', async () => {
    const { left, right, teardown } = await bothSeeded();

    await left.table<Design>('designs').clear();
    await right.table<Design>('designs').clear();

    expect(await left.table<Design>('designs').count()).to.equal(0);
    expect(await right.table<Design>('designs').count()).to.equal(0);
    await teardown();
  });
});

describe('differential: documented Cana behaviour', () => {
  it('refuses an update on a missing key and writes nothing', async () => {
    // Cana throws NotFound when update matches no key. A caller who ignores a
    // soft return cannot tell a no-op from a success; failing loudly is the
    // design decision (JUM-561).
    const { left, teardown } = await bothSeeded();
    const before = await left.table<Design>('designs').count();

    const failed = await left.table<Design>('designs')
      .update(99, { name: 'ghost' })
      .then(() => false)
      .catch(() => true);

    expect(failed).to.equal(true);
    expect(await left.table<Design>('designs').count()).to.equal(before);
    expect(await left.table<Design>('designs').get(99)).to.equal(undefined);
    await teardown();
  });

  it('both stores agree on an update that does match', async () => {
    const { left, right, teardown } = await bothSeeded();

    await left.table<Design>('designs').update(2, { name: 'renamed' });
    await right.table<Design>('designs').update(2, { name: 'renamed' });

    const leftRow = await left.table<Design>('designs').get(2);
    const rightRow = await right.table<Design>('designs').get(2);

    expect(leftRow).to.deep.equal(rightRow);
    expect(leftRow?.name).to.equal('renamed');
    await teardown();
  });
});
