/* eslint-disable @typescript-eslint/no-var-requires */
import type { DatabaseObservation, StorageEnvironment } from '../src';
import { StorageDurability, classifyOpen } from '../src';

/**
 * These suites live with the package they test.
 *
 * They sat under `apps/backend-template/test/unit` for a reason that has since
 * been removed: the runner targeted only that path, and Cana's own `test` script
 * was an echo, so putting them here would have produced the false green JUM-557
 * documents — a `test` script that passes while nothing runs.
 *
 * Both halves are closed now. `test-map.json` names their real location and
 * `run-unit-tests.js` runs the map rather than a directory, so the gate executes
 * them here; and `packages/cana`'s `test` script runs `bun test --isolate` over
 * this directory, which `packaging.test.ts` asserts — rejecting an echo, a
 * typecheck, or a script that defers elsewhere.
 */

const observation = (over: Partial<DatabaseObservation> = {}): DatabaseObservation => ({
  databaseName: 'designer',
  foundVersion: 1,
  isEmpty: false,
  ...over
});

const tombstone = (initial: Record<string, string> = {}) => {
  const store = new Map(Object.entries(initial));
  return {
    store,
    api: {
      get: (key: string) => store.get(key) ?? null,
      set: (key: string, value: string) => { store.set(key, value); },
      remove: (key: string) => { store.delete(key); }
    }
  };
};

describe('cana storage — eviction classification', () => {
  it('reports a genuine first run when no tombstone exists', () => {
    const verdict = classifyOpen(observation({ foundVersion: 0, isEmpty: true }), null);

    expect(verdict).to.deep.equal({ evicted: false, reason: 'first-run' });
  });

  it('reports eviction when the database is gone but was known to exist', () => {
    // The case that matters: an empty open that is NOT a first run.
    const verdict = classifyOpen(
      observation({ foundVersion: 0, isEmpty: true }),
      JSON.stringify({ version: 1, at: 1 })
    );

    expect(verdict).to.deep.equal({ evicted: true, reason: 'evicted-database-absent' });
  });

  it('reports eviction when the store shell survived but the contents did not', () => {
    // Some browsers recreate the database and drop its records. `hadData` is what
    // separates that from a database the user never wrote to.
    const verdict = classifyOpen(
      observation({ foundVersion: 1, isEmpty: true }),
      JSON.stringify({ version: 1, at: 1, hadData: true })
    );

    expect(verdict).to.deep.equal({ evicted: true, reason: 'evicted-database-empty' });
  });

  it('does not report eviction for a database that was never written to', () => {
    // The false positive this guard prevents: a user opens the app, writes
    // nothing, reopens — and is told their data was lost. Without `hadData`,
    // tombstone-present plus empty was enough to claim eviction.
    const verdict = classifyOpen(
      observation({ foundVersion: 1, isEmpty: true }),
      JSON.stringify({ version: 1, at: 1, hadData: false })
    );

    expect(verdict).to.deep.equal({ evicted: false, reason: 'existing-data' });
  });

  it('treats a tombstone written before hadData existed as no evidence of data', () => {
    // Forward compatibility: an old marker must not start reporting losses.
    const verdict = classifyOpen(
      observation({ foundVersion: 1, isEmpty: true }),
      JSON.stringify({ version: 1, at: 1 })
    );

    expect(verdict.evicted).to.equal(false);
  });

  it('reports normal operation when data is present', () => {
    const verdict = classifyOpen(observation(), JSON.stringify({ version: 1, at: 1 }));

    expect(verdict).to.deep.equal({ evicted: false, reason: 'existing-data' });
  });

  it('never reports eviction as a first run, across the whole decision table', () => {
    // The property under test, stated directly: an open that follows a recorded
    // existence must never come back as 'first-run', whatever the shape of the
    // database. Reporting lost work as a welcome screen is the failure this
    // module exists to prevent.
    const hadData = JSON.stringify({ version: 1, at: 1 });
    const cases: DatabaseObservation[] = [
      observation({ foundVersion: 0, isEmpty: true }),
      observation({ foundVersion: 1, isEmpty: true }),
      observation({ foundVersion: 2, isEmpty: true }),
      observation({ foundVersion: 1, isEmpty: false })
    ];

    const reasons = cases.map((entry) => classifyOpen(entry, hadData).reason);

    expect(reasons).not.to.include('first-run');
  });
});

describe('cana storage — durability surface', () => {
  it('reports persistence as unknown, not false, when the API is absent', async () => {
    // 'unknown' and false are different claims: one is "the browser refused",
    // the other is "we cannot tell". Flattening them lets an application promise
    // durability it does not have.
    const durability = new StorageDurability({});

    expect(await durability.requestPersistence()).to.equal('unknown');
    expect(await durability.state()).to.deep.include({ persistent: 'unknown' });
  });

  it('reports undetectable eviction when no durable tombstone is available', () => {
    // Private browsing. Eviction cannot be detected here, and saying so beats
    // silently reporting 'first-run'.
    const durability = new StorageDurability({});
    const verdict = durability.evaluateOpen(observation({ foundVersion: 0, isEmpty: true }));

    expect(verdict.reason).to.equal('undetectable-no-tombstone');
    expect(durability.recordExistence('designer', 1)).to.equal(false);
  });

  it('records existence and then recognises the eviction on a later open', () => {
    const fake = tombstone();
    const durability = new StorageDurability({ tombstone: fake.api });

    expect(durability.recordExistence('designer', 1)).to.equal(true);
    const verdict = durability.evaluateOpen(observation({ foundVersion: 0, isEmpty: true }));

    expect(verdict).to.deep.equal({ evicted: true, reason: 'evicted-database-absent' });
    expect(durability.lastEvictionVerdict).to.deep.equal(verdict);
  });

  it('surfaces the eviction flag in state until it is acknowledged', async () => {
    const fake = tombstone({ 'cana.existed.v1:designer': JSON.stringify({ version: 1, at: 1 }) });
    const durability = new StorageDurability({ tombstone: fake.api });

    durability.evaluateOpen(observation({ foundVersion: 0, isEmpty: true }));

    expect(await durability.state()).to.deep.include({ evicted: true });
    durability.acknowledgeEviction();
    expect(await durability.state()).to.deep.include({ evicted: false });
  });

  it('raises nearQuota before hard failure so an export is still possible', async () => {
    // The threshold exists to leave room for recovery. With no fallback, the
    // export is the only recovery, so warning at 100% would be useless.
    const environment: StorageEnvironment = {
      estimate: async () => ({ usage: 90, quota: 100 })
    };

    expect(await new StorageDurability(environment).state())
      .to.deep.include({ nearQuota: true, usageBytes: 90, quotaBytes: 100 });

    const roomy: StorageEnvironment = { estimate: async () => ({ usage: 10, quota: 100 }) };

    expect(await new StorageDurability(roomy).state()).to.deep.include({ nearQuota: false });
  });

  it('survives an environment whose storage APIs throw', async () => {
    const hostile: StorageEnvironment = {
      estimate: async () => { throw new Error('denied'); },
      persisted: async () => { throw new Error('denied'); }
    };

    expect(await new StorageDurability(hostile).state()).to.deep.include({ persistent: 'unknown', nearQuota: false });
  });

  /**
   * An environment that can be asked whether storage is durable but cannot be
   * asked to make it durable — the shape Safari presents.
   *
   * The answer has to be `unknown`, not `false`. `false` reads as "the browser
   * declined", a state a caller might retry or warn about; this is "the browser
   * will not say", and the data may well survive. Returning the wrong one would
   * have the application warn about a condition it cannot observe.
   */
  it('reports unknown when durability can be queried but not requested', async () => {
    // Safari's shape: `persisted()` exists, `persist()` does not. The page can
    // ask whether storage is durable and cannot ask for it to become durable.
    const queryOnly: StorageEnvironment = {
      persisted: async () => false
    };

    // `unknown`, not `false`. `false` reads as "the browser declined" — a state
    // a caller might retry or warn about. This is "there is no way to ask", and
    // the data may well survive; warning about it would be noise.
    expect(await new StorageDurability(queryOnly).requestPersistence()).to.equal('unknown');
  });
});

/**
 * Tombstones that cannot be trusted.
 *
 * The tombstone lives in `localStorage`, which anything on the origin can write
 * to and which survives code the application no longer ships. So the value read
 * back is not guaranteed to be a tombstone at all, and eviction detection —
 * which decides whether a user is told their work was lost — must not depend on
 * it being well-formed.
 */
describe('cana storage — untrustworthy tombstones', () => {
  it('treats an unparseable tombstone as recording no data', () => {
    // `hadData` cannot be read, so the safe reading is "we do not know that
    // there was data" — which errs towards not claiming a loss. Claiming one
    // falsely is worse: it tells a user to restore a backup they do not need.
    const verdict = classifyOpen(
      observation({ foundVersion: 1, isEmpty: true }),
      'not json at all {{{'
    );

    expect(verdict).to.deep.equal({ evicted: false, reason: 'existing-data' });
  });

  it('treats a tombstone without hadData as recording no data', () => {
    // Tombstones written before `hadData` existed parse cleanly and simply lack
    // the field. Same conclusion, reached without an exception.
    const verdict = classifyOpen(
      observation({ foundVersion: 1, isEmpty: true }),
      JSON.stringify({ version: 1, at: 1 })
    );

    expect(verdict).to.deep.equal({ evicted: false, reason: 'existing-data' });
  });

  it('reports eviction when the tombstone says data existed', () => {
    // The control. Without it, the two cases above would be satisfied by a
    // classifier that never reports eviction on an empty-but-present database.
    const verdict = classifyOpen(
      observation({ foundVersion: 1, isEmpty: true }),
      JSON.stringify({ version: 1, at: 1, hadData: true })
    );

    expect(verdict.evicted).to.equal(true);
  });
});
