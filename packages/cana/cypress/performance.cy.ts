import type { CanaSchema } from '../src';
import { createClient } from '../src';

/**
 * Performance baseline (JUM-561, second half).
 *
 * `explain()` proves an indexed query opened its index and that offset was
 * applied in the cursor. It proves nothing about speed. This measures the thing
 * the plan only claims.
 *
 * ## What these assert, and what they deliberately do not
 *
 * They assert **complexity, not latency**. A wall-clock threshold on a shared CI
 * runner is a flaky test that gets deleted within a month, and deleting it takes
 * the coverage with it. So the assertions are ratios: an indexed lookup over
 * 10k rows must not cost proportionally more than one over 1k, and a limited
 * query must not scale with table size at all.
 *
 * A full scan that got 10x slower with 10x the data is correct behaviour. An
 * *indexed* query that did is the bug — it means the index was announced and not
 * used, which is exactly the failure `explain()` was built to make visible and
 * which no correctness test can detect.
 *
 * ## What this is NOT
 *
 * These now run against a browser's own disk-backed IndexedDB, so the constant
 * factors are real — but a shared CI runner's are still not a user's laptop, so
 * **no absolute number here transfers to production**. What transfers is the
 * shape: if an operation
 * scales linearly here where it should be logarithmic or constant, it will scale
 * linearly in a browser too, only worse.
 */

interface Row { id: number; group: string; value: number }

const schema: CanaSchema = {
  version: 1,
  stores: [{
    name: 'rows',
    keyPath: 'id',
    indexes: [
      { name: 'byGroup', keyPath: 'group' },
      { name: 'byValue', keyPath: 'value' }
    ]
  }]
};

/** One row per id, spread across 100 groups so an index is selective. */
const makeRows = (count: number): Row[] => Array.from({ length: count }, (_, index) => ({
  id: index,
  group: `g${index % 100}`,
  value: index
}));

async function seeded(count: number) {
  const client = createClient({
    name: `perf-${count}-${Math.random().toString(36).slice(2, 8)}`,
    schema
  });
  await client.open();
  await client.table<Row>('rows').bulkAdd(makeRows(count));
  return client;
}

/** Median of several runs, so one scheduling hiccup does not decide the result. */
async function median(runs: number, operation: () => Promise<unknown>): Promise<number> {
  const samples: number[] = [];
  for (let run = 0; run < runs; run += 1) {
    const started = performance.now();
    // eslint-disable-next-line no-await-in-loop
    await operation();
    samples.push(performance.now() - started);
  }
  return samples.sort((a, b) => a - b)[Math.floor(samples.length / 2)];
}

const SMALL = 1_000;
const LARGE = 10_000;

describe('cana performance shape', () => {
  it('does not scale a limited query with table size', async function () {
    // Seeding and draining a real IndexedDB is not instant; Mocha's own
    // timeout is what governs an async test here.
    this.timeout(60_000);
    // The claim `explain()` makes: `limit: 10` reads ten records, not the table.
    // If this scaled with size, the cursor would be materialising everything and
    // slicing — which passes every correctness test ever written.
    const small = await seeded(SMALL);
    const large = await seeded(LARGE);

    const smallTime = await median(5, () => small.table<Row>('rows').query({ limit: 10 }));
    const largeTime = await median(5, () => large.table<Row>('rows').query({ limit: 10 }));

    // 10x the data. A cursor-limited read should be near-flat; 4x leaves ample
    // headroom for noise while still failing a linear implementation. The floor
    // allows equality because some CI browsers quantize tiny timings to 5ms.
    expect(largeTime).to.be.at.most(Math.max(smallTime * 4, 5));
    await small.close();
    await large.close();
  });

  it('does not scale an indexed lookup proportionally with table size', async function () {
    // Seeding and draining a real IndexedDB is not instant; Mocha's own
    // timeout is what governs an async test here.
    this.timeout(60_000);
    // 100 groups, so 10x the rows means 10x the matches — the result set grows
    // but the search should not degrade on top of that. A linear scan would show
    // considerably worse than the 10x the result set alone accounts for.
    const small = await seeded(SMALL);
    const large = await seeded(LARGE);

    const smallTime = await median(
      5,
      () => small.table<Row>('rows').query({ index: 'byGroup', equals: 'g7' })
    );
    const largeTime = await median(
      5,
      () => large.table<Row>('rows').query({ index: 'byGroup', equals: 'g7' })
    );

    expect(largeTime).to.be.lessThan(Math.max(smallTime * 25, 20));
    await small.close();
    await large.close();
  });

  it('counts without reading the rows', async function () {
    // Seeding and draining a real IndexedDB is not instant; Mocha's own
    // timeout is what governs an async test here.
    this.timeout(60_000);
    // `count()` uses IndexedDB's native count — one request. If it were reading
    // records it would track the cost of a full query, and this comparison is
    // what would show it.
    const client = await seeded(LARGE);

    const countTime = await median(5, () => client.table<Row>('rows').count());
    const readTime = await median(5, () => client.table<Row>('rows').query());

    expect(countTime).to.be.lessThan(readTime);
    await client.close();
  });

  it('does not scale a keyed get with table size', async function () {
    // Seeding and draining a real IndexedDB is not instant; Mocha's own
    // timeout is what governs an async test here.
    this.timeout(60_000);
    // A primary-key get is the most common operation in any application. It must
    // be independent of how much else is stored.
    const small = await seeded(SMALL);
    const large = await seeded(LARGE);

    const smallTime = await median(10, () => small.table<Row>('rows').get(500));
    const largeTime = await median(10, () => large.table<Row>('rows').get(500));

    expect(largeTime).to.be.at.most(Math.max(smallTime * 4, 5));
    await small.close();
    await large.close();
  });

  it('completes a bulk write of ten thousand rows', async function () {
    // Seeding and draining a real IndexedDB is not instant; Mocha's own
    // timeout is what governs an async test here.
    this.timeout(120_000);
    // Not a speed assertion — a completeness one. Bulk writes are sequential by
    // design so `failedAt` indices line up with the input, and a naive
    // implementation can stack ten thousand promises and exhaust the stack.
    // This is the test that would catch that.
    const client = createClient({
      name: `perf-bulk-${Math.random().toString(36).slice(2, 8)}`,
      schema
    });
    await client.open();

    const result = await client.table<Row>('rows').bulkAdd(makeRows(LARGE));

    expect(result.outcome).to.equal('committed');
    expect(result.keys).to.have.lengthOf(LARGE);
    expect(await client.table<Row>('rows').count()).to.equal(LARGE);
    await client.close();
  });

  it('applies a deep offset through the cursor rather than materialising', async function () {
    // Seeding and draining a real IndexedDB is not instant; Mocha's own
    // timeout is what governs an async test here.
    this.timeout(60_000);
    // Deep pagination is where slice-after-read collapses: page 500 costs as
    // much as reading the whole table. Advancing the cursor should cost roughly
    // the same as an early page.
    const client = await seeded(LARGE);

    const earlyPage = await median(
      5,
      () => client.table<Row>('rows').query({ offset: 10, limit: 20 })
    );
    const deepPage = await median(
      5,
      () => client.table<Row>('rows').query({ offset: 9_000, limit: 20 })
    );

    // `advance()` still walks the index, so a deep offset is not free — but it
    // must not cost what reading nine thousand full records would.
    expect(deepPage).to.be.lessThan(Math.max(earlyPage * 60, 60));
    await client.close();
  });
});

/*
 * NO ABSOLUTE NUMBERS ARE ASSERTED HERE, deliberately.
 *
 * These run against a browser's own disk-backed IndexedDB, which is the right
 * cost profile — but a shared CI runner's disk and scheduler are not a user's,
 * so a millisecond threshold measured here would still be flaky and would still
 * say nothing about production.
 *
 * A real latency baseline needs the browser conformance run — JUM-417 — and
 * until that exists, nobody should be told Cana is fast on the basis of this
 * file. What this file establishes is that nothing scales in a shape that would
 * make it slow.
 */
