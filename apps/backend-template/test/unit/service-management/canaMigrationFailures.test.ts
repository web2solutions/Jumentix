/* eslint-disable @typescript-eslint/no-var-requires */
import path from 'node:path';

/**
 * The migration's refusals, and the ambient defaults it boots with (JUM-681).
 *
 * The suite beside this one drives the happy path and the main recovery paths
 * over the real store. What it never reaches is the half of this file that only
 * runs when something is already wrong: a payload Cana accepted but reads back
 * differently, a baseline that fails to persist after the state succeeded, a
 * `localStorage` that throws on every access, a marker written by a version
 * that did not finish verifying.
 *
 * Every one of those returns `status: 'failed'` **and leaves the source
 * intact** — the migration is one-way, so the moment it deletes the
 * localStorage copy over an unverified write, the data is gone. That property
 * is what these assert; the reason strings are checked because they are what
 * the user is shown when it happens.
 *
 * The doubles are the **storage backend** and the **store port**
 * (Requirement 135 §5/§7): both are declared interfaces of infrastructure, and
 * the failures asserted here are ones real infrastructure produces but cannot
 * be asked for on demand — a quota-exceeded `setItem`, a read-back mismatch.
 * The migration itself is real.
 */
const repoRoot = path.resolve(__dirname, '../../../../..');
const migrationPath = path.join(repoRoot, 'apps', 'service-management', 'src', 'store', 'canaMigration.js');
const {
  migrateLocalStorageToCana,
  readRetainedMigrationSource,
  describeDesignerStorageEnvironment,
  describeLoadTimeDataLoss,
  CANA_MIGRATION_SOURCE_STATE_KEY,
  CANA_MIGRATION_SOURCE_BASELINE_KEY
} = require(migrationPath);

const MARKER_KEY = 'service-management.v1.cana-migration';
const STATE = JSON.stringify({ domains: [{ id: 'd1', name: 'Domain' }] });

/** A `Storage`-shaped double whose reads and writes can be made to throw. */
function storageDouble(entries: Record<string, string> = {}, faults: {
  readThrows?: boolean;
  writeThrows?: boolean;
  removeThrows?: boolean;
} = {}) {
  const items = new Map(Object.entries(entries));
  return {
    items,
    getItem(key: string) {
      if (faults.readThrows) throw new Error('storage read denied');
      return items.has(key) ? items.get(key) as string : null;
    },
    setItem(key: string, value: string) {
      if (faults.writeThrows) throw new Error('quota exceeded');
      items.set(key, value);
    },
    removeItem(key: string) {
      if (faults.removeThrows) throw new Error('storage remove denied');
      items.delete(key);
    }
  };
}

/** The refusal a blocked or evicted storage backend raises on read. */
function raiseReadDenied(): never {
  throw new Error('storage read denied');
}

/** A storage backend whose reads start throwing after the first `allowed` of them. */
function throwingAfterReads(allowed: number, entries: Record<string, string> = {}) {
  const storage = storageDouble(entries);
  let reads = 0;
  return {
    ...storage,
    getItem(key: string) {
      reads += 1;
      const denied = reads > allowed;
      return denied ? raiseReadDenied() : storage.getItem(key);
    }
  };
}

/** A storage backend that throws only for one key. */
function throwingForKey(deniedKey: string, entries: Record<string, string> = {}) {
  const storage = storageDouble(entries);
  return {
    ...storage,
    getItem(key: string) {
      return key === deniedKey ? raiseReadDenied() : storage.getItem(key);
    }
  };
}

/** The designer store port, scripted per call. */
function storeDouble(script: {
  save?: { status: string; reason?: string };
  saveBaseline?: { status: string; reason?: string };
  load?: { status: string; payload?: unknown; reason?: string };
  loadBaseline?: { status: string; payload?: unknown };
} = {}) {
  return {
    save: async () => script.save ?? { status: 'persisted' },
    saveBaseline: async () => script.saveBaseline ?? { status: 'persisted' },
    load: async () => script.load ?? { status: 'ok', payload: JSON.parse(STATE) },
    loadBaseline: async () => script.loadBaseline ?? { status: 'ok', payload: { schema: 1 } }
  };
}

describe('migrateLocalStorageToCana refusals (JUM-681)', () => {
  it('reports no source when there is no storage at all', async () => {
    expect.hasAssertions();

    // Node has no `localStorage`, so the ambient default resolves to nothing —
    // which is exactly the server-side render case this guard exists for.
    const result = await migrateLocalStorageToCana({ store: storeDouble() });

    expect(result.status).toBe('no-source');
    expect(result.reason).toBe('localStorage is not accessible in this context.');
  });

  it('reports no source when reading storage throws', async () => {
    expect.hasAssertions();

    // Blocked third-party storage throws on access rather than returning null.
    const result = await migrateLocalStorageToCana({
      storage: storageDouble({}, { readThrows: true }),
      store: storeDouble()
    });

    expect(result.status).toBe('no-source');
    expect(result.reason).toContain('localStorage could not be read: storage read denied');
  });

  it('ignores a marker that never reached verified status', async () => {
    expect.hasAssertions();

    // A marker written by a run that crashed mid-verification must not be read
    // as "already migrated" — that would strand the source and skip the copy.
    const storage = storageDouble({
      [MARKER_KEY]: JSON.stringify({ status: 'started' }),
      [CANA_MIGRATION_SOURCE_STATE_KEY]: STATE
    });

    const result = await migrateLocalStorageToCana({ storage, store: storeDouble() });

    expect(result.status).toBe('migrated');
  });

  it('ignores a marker that is not readable JSON', async () => {
    expect.hasAssertions();

    const storage = storageDouble({
      [MARKER_KEY]: 'not json',
      [CANA_MIGRATION_SOURCE_STATE_KEY]: STATE
    });

    const result = await migrateLocalStorageToCana({ storage, store: storeDouble() });

    expect(result.status).toBe('migrated');
  });

  it('retires the retained source once its window has passed', async () => {
    expect.hasAssertions();

    const storage = storageDouble({
      [MARKER_KEY]: JSON.stringify({
        status: 'verified',
        migratedAt: '2026-01-01T00:00:00.000Z',
        sourceRetainedUntil: '2026-02-01T00:00:00.000Z'
      }),
      [CANA_MIGRATION_SOURCE_STATE_KEY]: STATE,
      [CANA_MIGRATION_SOURCE_BASELINE_KEY]: '{"schema":1}'
    });

    const result = await migrateLocalStorageToCana({
      storage,
      store: storeDouble(),
      now: () => new Date('2026-03-01T00:00:00.000Z')
    });

    expect(result).toStrictEqual({
      status: 'already-migrated',
      sourceRetained: false,
      migratedAt: '2026-01-01T00:00:00.000Z'
    });
    expect(storage.items.has(CANA_MIGRATION_SOURCE_STATE_KEY)).toBe(false);
  });

  it('still reports the retirement when the removal itself throws', async () => {
    expect.hasAssertions();

    // Housekeeping that throws must not break boot: the migration is done
    // either way, and the alternative is an app that cannot start.
    const storage = storageDouble({
      [MARKER_KEY]: JSON.stringify({
        status: 'verified',
        migratedAt: '2026-01-01T00:00:00.000Z',
        sourceRetainedUntil: '2026-02-01T00:00:00.000Z'
      })
    }, { removeThrows: true });

    const result = await migrateLocalStorageToCana({
      storage,
      store: storeDouble(),
      now: () => new Date('2026-03-01T00:00:00.000Z')
    });

    expect(result.status).toBe('already-migrated');
    expect(result.sourceRetained).toBe(false);
  });

  it('keeps the source when the state payload fails to persist', async () => {
    expect.hasAssertions();

    const storage = storageDouble({ [CANA_MIGRATION_SOURCE_STATE_KEY]: STATE });

    const result = await migrateLocalStorageToCana({
      storage,
      store: storeDouble({ save: { status: 'rejected', reason: 'quota' } })
    });

    expect(result.status).toBe('failed');
    expect(result.reason).toContain('save-failed: the payload could not be written to Cana (quota)');
    expect(storage.items.get(CANA_MIGRATION_SOURCE_STATE_KEY)).toBe(STATE);
  });

  it('names the status when a failed save carries no reason', async () => {
    expect.hasAssertions();

    // Without the fallback the message reads "written to Cana ()", which tells
    // a user reporting the failure nothing at all.
    const result = await migrateLocalStorageToCana({
      storage: storageDouble({ [CANA_MIGRATION_SOURCE_STATE_KEY]: STATE }),
      store: storeDouble({ save: { status: 'unavailable' } })
    });

    expect(result.reason).toContain('written to Cana (unavailable)');
  });

  it('keeps the source when the baseline fails to persist after the state', async () => {
    expect.hasAssertions();

    // The state is already in Cana at this point. Failing here and keeping the
    // source is what makes the retry safe: the next run overwrites both.
    const storage = storageDouble({
      [CANA_MIGRATION_SOURCE_STATE_KEY]: STATE,
      [CANA_MIGRATION_SOURCE_BASELINE_KEY]: '{"schema":1}'
    });

    const result = await migrateLocalStorageToCana({
      storage,
      store: storeDouble({ saveBaseline: { status: 'rejected', reason: 'disk full' } })
    });

    expect(result.status).toBe('failed');
    expect(result.reason).toContain('the baseline could not be written to Cana (disk full)');
    expect(storage.items.get(CANA_MIGRATION_SOURCE_STATE_KEY)).toBe(STATE);
  });

  it('migrates the state without a baseline that cannot be parsed', async () => {
    expect.hasAssertions();

    // A corrupt baseline is a note, not a failure — it is derived data, and
    // refusing the whole migration over it would strand the real payload.
    const result = await migrateLocalStorageToCana({
      storage: storageDouble({
        [CANA_MIGRATION_SOURCE_STATE_KEY]: STATE,
        [CANA_MIGRATION_SOURCE_BASELINE_KEY]: '{oops'
      }),
      store: storeDouble()
    });

    expect(result.status).toBe('migrated');
    expect(result.baselineMigrated).toBe(false);
    expect(result.baselineNote).toContain('baseline-lost');
  });

  it('keeps the source when the read-back does not match what was written', async () => {
    expect.hasAssertions();

    // The whole reason the cutover is verified: a store that accepted the write
    // and returns something else has lost the document, and deleting the
    // localStorage copy at that point is unrecoverable.
    const storage = storageDouble({ [CANA_MIGRATION_SOURCE_STATE_KEY]: STATE });

    const result = await migrateLocalStorageToCana({
      storage,
      store: storeDouble({ load: { status: 'ok', payload: { domains: [] } } })
    });

    expect(result.status).toBe('failed');
    expect(result.reason).toContain('verification-mismatch');
    expect(storage.items.get(CANA_MIGRATION_SOURCE_STATE_KEY)).toBe(STATE);
  });

  it('carries the load reason into the mismatch message when there is one', async () => {
    expect.hasAssertions();

    const result = await migrateLocalStorageToCana({
      storage: storageDouble({ [CANA_MIGRATION_SOURCE_STATE_KEY]: STATE }),
      store: storeDouble({ load: { status: 'lost', reason: 'record evicted' } })
    });

    expect(result.reason).toContain('(load status lost, record evicted)');
  });

  it('keeps the source when the baseline read-back does not match', async () => {
    expect.hasAssertions();

    const storage = storageDouble({
      [CANA_MIGRATION_SOURCE_STATE_KEY]: STATE,
      [CANA_MIGRATION_SOURCE_BASELINE_KEY]: '{"schema":1}'
    });

    const result = await migrateLocalStorageToCana({
      storage,
      store: storeDouble({ loadBaseline: { status: 'ok', payload: { schema: 2 } } })
    });

    expect(result.status).toBe('failed');
    expect(result.reason).toContain('the baseline read back from Cana does not match');
    expect(storage.items.get(CANA_MIGRATION_SOURCE_STATE_KEY)).toBe(STATE);
  });

  it('treats a baseline that cannot be read as an absent one', async () => {
    expect.hasAssertions();

    // `getItem` throws for the baseline key as well as the state key here; the
    // state was read before the fault, so the migration proceeds without it.
    const result = await migrateLocalStorageToCana({
      storage: throwingAfterReads(2, { [CANA_MIGRATION_SOURCE_STATE_KEY]: STATE }),
      store: storeDouble()
    });

    expect(result.status).toBe('migrated');
    expect(result.baselineMigrated).toBe(false);
  });

  it('reports the marker as unwritten when storage refuses the write', async () => {
    expect.hasAssertions();

    // Without the marker the migration simply re-runs next boot — idempotent,
    // and reported rather than assumed.
    const result = await migrateLocalStorageToCana({
      storage: {
        ...storageDouble({ [CANA_MIGRATION_SOURCE_STATE_KEY]: STATE }),
        setItem: () => { throw new Error('quota exceeded'); }
      },
      store: storeDouble()
    });

    expect(result.status).toBe('migrated');
    expect(result.markerPersisted).toBe(false);
  });

  it('reports the provenance record as unwritten when the store has no client', async () => {
    expect.hasAssertions();

    // The record is bookkeeping beside the two contract documents; a store that
    // cannot take it still completes a verified migration.
    const result = await migrateLocalStorageToCana({
      storage: storageDouble({ [CANA_MIGRATION_SOURCE_STATE_KEY]: STATE }),
      store: storeDouble()
    });

    expect(result.status).toBe('migrated');
    expect(result.migrationRecordPersisted).toBe(false);
  });

  it('writes the provenance record when the store exposes a transaction', async () => {
    expect.hasAssertions();

    const written: Array<{ key: string; value: string }> = [];
    const store = {
      ...storeDouble(),
      storeName: 'designerDocuments',
      ensureOpen: async () => ({ ok: true }),
      client: {
        transaction: async (
          _mode: string,
          _stores: string[],
          body: (scope: unknown) => Promise<unknown>
        ) => {
          await body({
            table: () => ({
              put: async (value: string, key: string) => { written.push({ key, value }); }
            })
          });
          return { outcome: 'committed' };
        }
      }
    };

    const result = await migrateLocalStorageToCana({
      storage: storageDouble({ [CANA_MIGRATION_SOURCE_STATE_KEY]: STATE }),
      store
    });

    expect(result.migrationRecordPersisted).toBe(true);
    expect(JSON.parse(written[0].value)).toMatchObject({ source: 'localstorage', verified: true });
  });

  it('reports the record as unwritten when the store will not open', async () => {
    expect.hasAssertions();

    const result = await migrateLocalStorageToCana({
      storage: storageDouble({ [CANA_MIGRATION_SOURCE_STATE_KEY]: STATE }),
      store: { ...storeDouble(), ensureOpen: async () => ({ ok: false }) }
    });

    expect(result.migrationRecordPersisted).toBe(false);
  });

  it('reports the record as unwritten when the transaction throws', async () => {
    expect.hasAssertions();

    const result = await migrateLocalStorageToCana({
      storage: storageDouble({ [CANA_MIGRATION_SOURCE_STATE_KEY]: STATE }),
      store: {
        ...storeDouble(),
        storeName: 'designerDocuments',
        ensureOpen: async () => ({ ok: true }),
        client: { transaction: async () => { throw new Error('transaction aborted'); } }
      }
    });

    expect(result.migrationRecordPersisted).toBe(false);
  });
});

describe('readRetainedMigrationSource (JUM-681)', () => {
  const marker = (retainedUntil: string) => JSON.stringify({
    status: 'verified',
    migratedAt: '2026-01-01T00:00:00.000Z',
    sourceRetainedUntil: retainedUntil
  });

  it('reports nothing retained without a storage backend', () => {
    expect.hasAssertions();

    expect(readRetainedMigrationSource()).toStrictEqual({ retained: false });
  });

  it('reports nothing retained without a verified marker', () => {
    expect.hasAssertions();

    expect(readRetainedMigrationSource({ storage: storageDouble() }))
      .toStrictEqual({ retained: false });
  });

  it('reports the retained copy inside its window', () => {
    expect.hasAssertions();

    const storage = storageDouble({
      [MARKER_KEY]: marker('2026-06-01T00:00:00.000Z'),
      [CANA_MIGRATION_SOURCE_STATE_KEY]: STATE
    });

    expect(readRetainedMigrationSource({
      storage,
      now: () => new Date('2026-03-01T00:00:00.000Z')
    })).toStrictEqual({ retained: true, retainedUntil: '2026-06-01T00:00:00.000Z' });
  });

  it('reports nothing retained once the window has passed', () => {
    expect.hasAssertions();

    const storage = storageDouble({
      [MARKER_KEY]: marker('2026-02-01T00:00:00.000Z'),
      [CANA_MIGRATION_SOURCE_STATE_KEY]: STATE
    });

    expect(readRetainedMigrationSource({
      storage,
      now: () => new Date('2026-03-01T00:00:00.000Z')
    })).toStrictEqual({ retained: false });
  });

  it('reports nothing retained when the marker carries no window', () => {
    expect.hasAssertions();

    const storage = storageDouble({
      [MARKER_KEY]: JSON.stringify({ status: 'verified' }),
      [CANA_MIGRATION_SOURCE_STATE_KEY]: STATE
    });

    expect(readRetainedMigrationSource({ storage })).toStrictEqual({ retained: false });
  });

  it('reports nothing retained when the copy itself is gone', () => {
    expect.hasAssertions();

    // The marker says retained, the payload is not there — a user who cleared
    // one key by hand must not be told a recovery copy exists.
    const storage = storageDouble({ [MARKER_KEY]: marker('2026-06-01T00:00:00.000Z') });

    expect(readRetainedMigrationSource({
      storage,
      now: () => new Date('2026-03-01T00:00:00.000Z')
    })).toStrictEqual({ retained: false });
  });

  it('reports nothing retained when reading the copy throws', () => {
    expect.hasAssertions();

    expect(readRetainedMigrationSource({
      storage: throwingForKey(CANA_MIGRATION_SOURCE_STATE_KEY, {
        [MARKER_KEY]: marker('2026-06-01T00:00:00.000Z')
      }),
      now: () => new Date('2026-03-01T00:00:00.000Z')
    })).toStrictEqual({ retained: false });
  });
});

describe('describeDesignerStorageEnvironment (JUM-681)', () => {
  it('names an unsupported runtime', () => {
    expect.hasAssertions();

    const state = describeDesignerStorageEnvironment({ indexedDbPresent: false });

    expect(state.kind).toBe('unsupported-environment');
    expect(state.severity).toBe('error');
  });

  it('names a non-persisting session, with and without a cause', () => {
    expect.hasAssertions();

    const bare = describeDesignerStorageEnvironment({
      indexedDbPresent: true,
      probeStatus: 'unavailable'
    });
    const caused = describeDesignerStorageEnvironment({
      indexedDbPresent: true,
      probeStatus: 'unavailable',
      probeReason: 'private browsing'
    });

    expect(bare.kind).toBe('non-persisting-session');
    expect(bare.message).not.toContain('Cause:');
    expect(caused.message).toContain('Cause: private browsing');
  });

  it('names lost data, with and without a cause', () => {
    expect.hasAssertions();

    const bare = describeDesignerStorageEnvironment({ indexedDbPresent: true, probeStatus: 'lost' });
    const caused = describeDesignerStorageEnvironment({
      indexedDbPresent: true,
      probeStatus: 'lost',
      probeReason: 'eviction'
    });

    expect(bare.kind).toBe('data-lost');
    expect(caused.message).toContain('Cause: eviction');
  });

  it('names degraded durability only when a working probe reports a reason', () => {
    expect.hasAssertions();

    const degraded = describeDesignerStorageEnvironment({
      indexedDbPresent: true,
      probeStatus: 'available',
      probeReason: 'persistence not granted'
    });
    const healthy = describeDesignerStorageEnvironment({
      indexedDbPresent: true,
      probeStatus: 'available'
    });

    expect(degraded).toStrictEqual({
      kind: 'degraded-durability',
      severity: 'info',
      message: 'Storage is working but durability is degraded: persistence not granted'
    });
    expect(healthy).toStrictEqual({ kind: 'ok', severity: 'info', message: null });
  });

  it('reports ok when called with nothing at all', () => {
    expect.hasAssertions();

    expect(describeDesignerStorageEnvironment().kind).toBe('ok');
  });
});

describe('describeLoadTimeDataLoss (JUM-681)', () => {
  it('names the retained copy as the recourse when there is one', () => {
    expect.hasAssertions();

    const state = describeLoadTimeDataLoss({
      reason: 'record unreadable',
      retainedSource: { retained: true, retainedUntil: '2026-06-01T00:00:00.000Z' }
    });

    expect(state.message).toContain(CANA_MIGRATION_SOURCE_STATE_KEY);
    expect(state.message).toContain('2026-06-01T00:00:00.000Z');
  });

  it('falls back to earlier exports when nothing is retained', () => {
    expect.hasAssertions();

    const withVerdict = describeLoadTimeDataLoss({ retainedSource: { retained: false } });
    const withNothing = describeLoadTimeDataLoss();

    expect(withVerdict.severity).toBe('error');
    expect(withVerdict.message).not.toContain(CANA_MIGRATION_SOURCE_STATE_KEY);
    expect(withNothing.message).not.toContain(CANA_MIGRATION_SOURCE_STATE_KEY);
  });
});

/**
 * The last shapes a caller can hand the migration (JUM-721).
 *
 * Called with nothing at all, with a marker that names no retention window, and
 * with a store whose refusal carries no reason: three inputs the app produces
 * and the suite above does not. Each lands on a fallback whose job is to keep
 * the message readable — "written to Cana ()" and "undefined" are what the user
 * is shown when they are missing.
 */
describe('migration inputs at their edges (JUM-721)', () => {
  it('is callable with no options at all', async () => {
    expect.hasAssertions();

    // The boot path calls it with an options object; a caller that forgets is
    // answered rather than crashed on a destructure.
    const result = await migrateLocalStorageToCana();

    expect(result.status).toBe('no-source');
  });

  it('treats a verified marker with no retention window as still retained', async () => {
    expect.hasAssertions();

    // `Date.parse(undefined)` is NaN, and a NaN window must not read as
    // "expired" — that would delete the user's only pre-migration copy.
    const storage = storageDouble({
      [MARKER_KEY]: JSON.stringify({ status: 'verified', migratedAt: '2026-01-01T00:00:00.000Z' }),
      [CANA_MIGRATION_SOURCE_STATE_KEY]: STATE
    });

    const result = await migrateLocalStorageToCana({
      storage,
      store: storeDouble(),
      now: () => new Date('2030-01-01T00:00:00.000Z')
    });

    expect(result.sourceRetained).toBe(true);
    expect(storage.items.get(CANA_MIGRATION_SOURCE_STATE_KEY)).toBe(STATE);
  });

  it('names the status when a baseline refusal carries no reason', async () => {
    expect.hasAssertions();

    const result = await migrateLocalStorageToCana({
      storage: storageDouble({
        [CANA_MIGRATION_SOURCE_STATE_KEY]: STATE,
        [CANA_MIGRATION_SOURCE_BASELINE_KEY]: '{"schema":1}'
      }),
      store: storeDouble({ saveBaseline: { status: 'unavailable' } })
    });

    expect(result.reason).toContain('written to Cana (unavailable)');
  });

  it('names a storage refusal that carries no message', async () => {
    expect.hasAssertions();

    // `String(error.message || error)` prints "undefined" without the fallback,
    // and this message is the one the user is shown when the migration cannot
    // read their data.
    const messageless = new Error('boom');
    messageless.message = '';
    const storage = {
      ...storageDouble(),
      getItem: () => { throw messageless; }
    };

    const result = await migrateLocalStorageToCana({ storage, store: storeDouble() });

    expect(result.status).toBe('no-source');
    expect(result.reason).toContain('localStorage could not be read: Error');
  });
});
