/* eslint-disable @typescript-eslint/no-var-requires */
import type { DatabaseObservation, StorageEnvironment } from '@jumentix/cana';
import { StorageDurability, classifyOpen } from '@jumentix/cana';

/**
 * Placed under `apps/backend-template/test/unit` rather than `packages/cana/test`
 * deliberately: `test:unit` only targets this path, and the package's own `test`
 * script is a typecheck. Putting the suite in the package would have produced the
 * exact false green Test Pyramid JUM-557 documents — a `test` script that passes
 * while no test runs.
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
    expect.hasAssertions();
    const verdict = classifyOpen(observation({ foundVersion: 0, isEmpty: true }), null);

    expect(verdict).toStrictEqual({ evicted: false, reason: 'first-run' });
  });

  it('reports eviction when the database is gone but was known to exist', () => {
    expect.hasAssertions();
    // The case that matters: an empty open that is NOT a first run.
    const verdict = classifyOpen(
      observation({ foundVersion: 0, isEmpty: true }),
      JSON.stringify({ version: 1, at: 1 })
    );

    expect(verdict).toStrictEqual({ evicted: true, reason: 'evicted-database-absent' });
  });

  it('reports eviction when the store shell survived but the contents did not', () => {
    expect.hasAssertions();
    // Some browsers recreate the database and drop its records.
    const verdict = classifyOpen(
      observation({ foundVersion: 1, isEmpty: true }),
      JSON.stringify({ version: 1, at: 1 })
    );

    expect(verdict).toStrictEqual({ evicted: true, reason: 'evicted-database-empty' });
  });

  it('reports normal operation when data is present', () => {
    expect.hasAssertions();
    const verdict = classifyOpen(observation(), JSON.stringify({ version: 1, at: 1 }));

    expect(verdict).toStrictEqual({ evicted: false, reason: 'existing-data' });
  });

  it('never reports eviction as a first run, across the whole decision table', () => {
    expect.hasAssertions();
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

    expect(reasons).not.toContain('first-run');
  });
});

describe('cana storage — durability surface', () => {
  it('reports persistence as unknown, not false, when the API is absent', async () => {
    expect.hasAssertions();
    // 'unknown' and false are different claims: one is "the browser refused",
    // the other is "we cannot tell". Flattening them lets an application promise
    // durability it does not have.
    const durability = new StorageDurability({});

    await expect(durability.requestPersistence()).resolves.toBe('unknown');
    await expect(durability.state()).resolves.toMatchObject({ persistent: 'unknown' });
  });

  it('reports undetectable eviction when no durable tombstone is available', () => {
    expect.hasAssertions();
    // Private browsing. Eviction cannot be detected here, and saying so beats
    // silently reporting 'first-run'.
    const durability = new StorageDurability({});
    const verdict = durability.evaluateOpen(observation({ foundVersion: 0, isEmpty: true }));

    expect(verdict.reason).toBe('undetectable-no-tombstone');
    expect(durability.recordExistence('designer', 1)).toBe(false);
  });

  it('records existence and then recognises the eviction on a later open', () => {
    expect.hasAssertions();
    const fake = tombstone();
    const durability = new StorageDurability({ tombstone: fake.api });

    expect(durability.recordExistence('designer', 1)).toBe(true);
    const verdict = durability.evaluateOpen(observation({ foundVersion: 0, isEmpty: true }));

    expect(verdict).toStrictEqual({ evicted: true, reason: 'evicted-database-absent' });
    expect(durability.lastEvictionVerdict).toStrictEqual(verdict);
  });

  it('surfaces the eviction flag in state until it is acknowledged', async () => {
    expect.hasAssertions();
    const fake = tombstone({ 'cana.existed.v1:designer': JSON.stringify({ version: 1, at: 1 }) });
    const durability = new StorageDurability({ tombstone: fake.api });

    durability.evaluateOpen(observation({ foundVersion: 0, isEmpty: true }));

    await expect(durability.state()).resolves.toMatchObject({ evicted: true });
    durability.acknowledgeEviction();
    await expect(durability.state()).resolves.toMatchObject({ evicted: false });
  });

  it('raises nearQuota before hard failure so an export is still possible', async () => {
    expect.hasAssertions();
    // The threshold exists to leave room for recovery. With no fallback, the
    // export is the only recovery, so warning at 100% would be useless.
    const environment: StorageEnvironment = {
      estimate: async () => ({ usage: 90, quota: 100 })
    };

    await expect(new StorageDurability(environment).state())
      .resolves.toMatchObject({ nearQuota: true, usageBytes: 90, quotaBytes: 100 });

    const roomy: StorageEnvironment = { estimate: async () => ({ usage: 10, quota: 100 }) };

    await expect(new StorageDurability(roomy).state()).resolves.toMatchObject({ nearQuota: false });
  });

  it('survives an environment whose storage APIs throw', async () => {
    expect.hasAssertions();
    const hostile: StorageEnvironment = {
      estimate: async () => { throw new Error('denied'); },
      persisted: async () => { throw new Error('denied'); }
    };

    await expect(new StorageDurability(hostile).state())
      .resolves.toMatchObject({ persistent: 'unknown', nearQuota: false });
  });
});
