import type { CanaSchema } from '../src';
import { createClient } from '../src';

/**
 * Query shape, asserted from the engine rather than from a clock (JUM-682).
 *
 * These questions were always the right ones: does a limited query read the
 * table, does an indexed lookup open its index, does a deep offset advance the
 * cursor or materialise nine thousand records. The answers used to be inferred
 * from wall-clock ratios on shared CI hardware — `largeTime <= smallTime * 4`,
 * `deepPage < earlyPage * 60` — which Requirement 134 §3 forbids for good
 * reason: the margins had to be loose enough to survive a noisy runner, and a
 * margin that loose passes a half-broken cursor too.
 *
 * `explain()` now reports `metrics.recordsExamined` and `metrics.cursorAdvanced`
 * alongside the plan, so the property is a number the engine states rather than
 * a duration a test guesses from. Ten records examined is ten records examined
 * on any machine, under any load, in any order.
 *
 * What is deliberately **not** here: latency. Nothing in this file says Cana is
 * fast, and nothing should be quoted as if it did. It says nothing scales in a
 * shape that would make it slow. A real latency baseline needs the browser
 * conformance run (JUM-417).
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

const SMALL = 1_000;
const LARGE = 10_000;

describe('cana query shape', () => {
  it('reads only the limit, whatever the table size', async function limitedQueryReadsTheLimit() {
    // Seeding a real IndexedDB is not instant; Mocha's own timeout governs.
    this.timeout(60_000);

    // The claim: `limit: 10` reads ten records, not the table. An
    // implementation that materialises the range and slices it returns the same
    // ten records and reports the same plan — it differs only in what it read,
    // which is why the engine now reports that.
    const small = await seeded(SMALL);
    const large = await seeded(LARGE);

    const smallRun = await small.table<Row>('rows').explain({ limit: 10 });
    const largeRun = await large.table<Row>('rows').explain({ limit: 10 });

    expect(smallRun.metrics.recordsExamined).to.equal(10);
    // Ten times the data, the same ten records read.
    expect(largeRun.metrics.recordsExamined).to.equal(10);
    expect(largeRun.records).to.have.lengthOf(10);

    await small.close();
    await large.close();
  });

  it('opens the index and reads only the matches', async function indexedLookupReadsMatches() {
    this.timeout(60_000);

    // 100 groups, so 10k rows hold 100 matches for one group. A scan would read
    // all 10,000 and filter; the index reads the 100 that match.
    const large = await seeded(LARGE);

    const run = await large.table<Row>('rows').explain({ index: 'byGroup', equals: 'g7' });

    expect(run.plan.usedIndex).to.equal('byGroup');
    expect(run.plan.fullScan).to.equal(false);
    expect(run.records).to.have.lengthOf(LARGE / 100);
    expect(run.metrics.recordsExamined).to.equal(LARGE / 100);

    await large.close();
  });

  it('advances a deep offset instead of reading through it', async function deepOffsetAdvances() {
    this.timeout(60_000);

    // Deep pagination is where read-then-slice collapses: page 450 costs as much
    // as reading the whole table. `advance()` skips without reading, so a page
    // at offset 9,000 examines the same twenty records as a page at offset 10.
    const client = await seeded(LARGE);

    const earlyPage = await client.table<Row>('rows').explain({ offset: 10, limit: 20 });
    const deepPage = await client.table<Row>('rows').explain({ offset: 9_000, limit: 20 });

    expect(earlyPage.metrics.recordsExamined).to.equal(20);
    expect(deepPage.metrics.recordsExamined).to.equal(20);
    expect(deepPage.plan.appliedOffsetInCursor).to.equal(true);
    expect(deepPage.metrics.cursorAdvanced).to.equal(true);
    expect(deepPage.records[0].id).to.equal(9_000);

    await client.close();
  });

  it('reads every record when the query asks for every record', async function fullReadExaminesAll() {
    this.timeout(60_000);

    // The control. Without it, `recordsExamined` could be returning
    // `records.length` and every assertion above would pass for the wrong
    // reason — the metric has to be able to say a large number too.
    const client = await seeded(SMALL);

    const run = await client.table<Row>('rows').explain();

    expect(run.metrics.recordsExamined).to.equal(SMALL);
    expect(run.metrics.cursorAdvanced).to.equal(false);

    await client.close();
  });

  it('counts the table without the query path', async function countMatchesTheTable() {
    this.timeout(60_000);

    // `count()` uses IndexedDB's native count — one request, no records read.
    // **That last part is not asserted here**, and the honest reason is that it
    // is not observable through the public API: `count` returns a number, not a
    // plan. The old test compared its duration against a full read, which is the
    // wall-clock inference this file exists to remove. What is asserted is that
    // count and the query path agree; JUM-706 covers exposing the metric.
    const client = await seeded(LARGE);

    const counted = await client.table<Row>('rows').count();
    const read = await client.table<Row>('rows').query();

    expect(counted).to.equal(LARGE);
    expect(read).to.have.lengthOf(LARGE);

    await client.close();
  });

  it('completes a bulk write of ten thousand rows', async function bulkWriteCompletes() {
    this.timeout(120_000);

    // Not a speed assertion — a completeness one, and it never was a timing
    // test. Bulk writes are sequential by design so `failedAt` indices line up
    // with the input, and a naive implementation can stack ten thousand promises
    // and exhaust the stack. This is the test that would catch that.
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
});
