/* eslint-disable @typescript-eslint/no-var-requires */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import type { CanaSchema } from '@jumentix/cana';
import {
  StorageDurability,
  deleteDatabase,
  isCanaErrorCode,
  openDatabase,
  validateSchema
} from '@jumentix/cana';

/**
 * Exercised against a real IndexedDB implementation (`fake-indexeddb`), not a
 * hand-rolled stub. A stub would agree with whatever the engine happens to do,
 * which is precisely the false parity JUM-406 warns about — and lifecycle is
 * where the spec's sharp edges live, so agreeing with a stub proves nothing.
 */

const schema = (over: Partial<CanaSchema> = {}): CanaSchema => ({
  version: 1,
  stores: [
    { name: 'designs', keyPath: 'id', indexes: [{ name: 'byName', keyPath: 'name' }] }
  ],
  ...over
});

/** A fresh factory per test, so no database state leaks between them. */
const freshFactory = () => new IDBFactory();

const tombstoneEnvironment = () => {
  const store = new Map<string, string>();
  return {
    store,
    environment: {
      tombstone: {
        get: (key: string) => store.get(key) ?? null,
        set: (key: string, value: string) => { store.set(key, value); },
        remove: (key: string) => { store.delete(key); }
      }
    }
  };
};

describe('cana schema validation', () => {
  it('accepts a well-formed schema', () => {
    expect.hasAssertions();
    expect(validateSchema(schema())).toStrictEqual([]);
  });

  it('rejects multiEntry combined with a compound keyPath', () => {
    expect.hasAssertions();
    // IndexedDB forbids this and reports it from inside a versionchange
    // transaction, where it reads as a broken upgrade rather than a bad schema.
    const problems = validateSchema(schema({
      stores: [{
        name: 'designs',
        keyPath: 'id',
        indexes: [{ name: 'bad', keyPath: ['a', 'b'], multiEntry: true }]
      }]
    }));

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('multiEntry cannot be combined with a compound keyPath');
  });

  it('rejects duplicate stores, duplicate indexes and empty compound key paths', () => {
    expect.hasAssertions();
    const problems = validateSchema(schema({
      stores: [
        { name: 'a', keyPath: [] },
        { name: 'a', keyPath: 'id', indexes: [{ name: 'i', keyPath: 'x' }, { name: 'i', keyPath: 'y' }] }
      ]
    }));

    expect(problems.some((entry) => entry.includes('compound keyPath is empty'))).toBe(true);
    expect(problems.some((entry) => entry.includes('declared more than once'))).toBe(true);
  });

  it('rejects a non-positive version', () => {
    expect.hasAssertions();
    expect(validateSchema(schema({ version: 0 }))[0]).toContain('version must be a positive integer');
  });
});

describe('cana database lifecycle', () => {
  it('opens, applies the schema, and reports the upgrade', async () => {
    expect.hasAssertions();
    const factory = freshFactory();
    const result = await openDatabase({ name: 'designer', schema: schema(), factory });

    expect(result.upgraded).toBe(true);
    expect([...result.database.objectStoreNames]).toStrictEqual(['designs']);
    expect([...result.database.transaction('designs').objectStore('designs').indexNames])
      .toStrictEqual(['byName']);
    result.database.close();
  });

  it('adds a store on a version bump without dropping the existing one', async () => {
    expect.hasAssertions();
    const factory = freshFactory();
    const first = await openDatabase({ name: 'designer', schema: schema(), factory });
    first.database.close();

    const upgraded = await openDatabase({
      name: 'designer',
      factory,
      schema: schema({
        version: 2,
        stores: [
          { name: 'designs', keyPath: 'id' },
          { name: 'deployments', keyPath: 'id' }
        ]
      })
    });

    expect([...upgraded.database.objectStoreNames].sort()).toStrictEqual(['deployments', 'designs']);
    upgraded.database.close();
  });

  it('leaves a store that disappeared from the schema in place rather than dropping it', async () => {
    expect.hasAssertions();
    // Dropping automatically means a typo in a schema literal silently deletes a
    // user's table. Removal is an explicit migration, never an inference.
    const factory = freshFactory();
    const first = await openDatabase({
      name: 'designer',
      factory,
      schema: schema({ stores: [{ name: 'designs', keyPath: 'id' }, { name: 'legacy', keyPath: 'id' }] })
    });
    first.database.close();

    const second = await openDatabase({
      name: 'designer',
      factory,
      schema: schema({ version: 2, stores: [{ name: 'designs', keyPath: 'id' }] })
    });

    expect([...second.database.objectStoreNames]).toContain('legacy');
    second.database.close();
  });

  it('refuses a downgrade and says why', async () => {
    expect.hasAssertions();
    const factory = freshFactory();
    const first = await openDatabase({ name: 'designer', factory, schema: schema({ version: 3 }) });
    first.database.close();

    await expect(openDatabase({ name: 'designer', factory, schema: schema({ version: 2 }) }))
      .rejects.toMatchObject({ canaError: true, code: 'UpgradeFailed' });
  });

  it('rejects an inapplicable schema before touching the database', async () => {
    expect.hasAssertions();
    const factory = freshFactory();

    await expect(openDatabase({
      name: 'designer',
      factory,
      schema: schema({ version: -1 })
    })).rejects.toMatchObject({ canaError: true, code: 'InvalidRequest' });

    // Nothing was created, so the failure left no partial state behind.
    const listed = await factory.databases();

    expect(listed.find((entry) => entry.name === 'designer')).toBeUndefined();
  });

  it('surfaces a typed error rather than a DOMException', async () => {
    expect.hasAssertions();
    const factory = freshFactory();
    const failure = await openDatabase({ name: 'designer', factory, schema: schema({ version: 0 }) })
      .catch((error: unknown) => error);

    expect(isCanaErrorCode(failure, 'InvalidRequest')).toBe(true);
    expect(failure).not.toBeInstanceOf(Error);
  });

  it('reports a first run as a first run', async () => {
    expect.hasAssertions();
    const factory = freshFactory();
    const { environment } = tombstoneEnvironment();
    const durability = new StorageDurability(environment);

    const result = await openDatabase({
      name: 'designer', factory, schema: schema(), durability
    });

    expect(result.eviction).toStrictEqual({ evicted: false, reason: 'first-run' });
    result.database.close();
  });

  it('reports eviction, not a first run, when a known database has vanished', async () => {
    expect.hasAssertions();
    // The end-to-end version of the property: open once so existence is recorded,
    // destroy the database as a browser would, then open again. The second open
    // sees an empty database — and must not call it a first run.
    const factory = freshFactory();
    const { environment } = tombstoneEnvironment();
    const durability = new StorageDurability(environment);

    const first = await openDatabase({
      name: 'designer', factory, schema: schema(), durability
    });
    first.database.close();
    await deleteDatabase('designer', { factory });

    const second = await openDatabase({
      name: 'designer', factory, schema: schema(), durability
    });

    expect(second.eviction.evicted).toBe(true);
    expect(second.eviction.reason).toBe('evicted-database-absent');
    await expect(durability.state()).resolves.toMatchObject({ evicted: true });
    second.database.close();
  });

  it('does not mistake an existing populated database for eviction', async () => {
    expect.hasAssertions();
    const factory = freshFactory();
    const { environment } = tombstoneEnvironment();
    const durability = new StorageDurability(environment);

    const first = await openDatabase({
      name: 'designer', factory, schema: schema(), durability
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = first.database.transaction('designs', 'readwrite');
      transaction.objectStore('designs').add({ id: 1, name: 'kept' });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    first.database.close();

    const second = await openDatabase({
      name: 'designer', factory, schema: schema(), durability
    });

    expect(second.eviction).toStrictEqual({ evicted: false, reason: 'existing-data' });
    second.database.close();
  });
});

/*
 * NOT COVERED, and stated rather than left to be discovered:
 *
 * The 'Unavailable' path — no IndexedDB at all, as in private browsing — is not
 * exercised here. The suite installs the fake-indexeddb shim ambiently, so the
 * global is always present, and an earlier attempt at this test had a tautological
 * assertion that passed regardless of behaviour. It was removed rather than
 * weakened.
 *
 * Covering it properly needs either a separate suite without the shim installed or
 * a real browser in private mode, which is JUM-417 territory.
 */

/**
 * Environment and schema edge cases in the open path.
 *
 * These were the last uncovered statements in `core/database.ts`, and they are
 * what a user meets first when something is wrong: no IndexedDB at all, or a
 * schema with nothing in it. Both are defensive, and a defensive branch that has
 * never executed is a guess about what it does.
 */
describe('cana database environment handling', () => {
  /** Swap the ambient IndexedDB for the duration of one test. */
  const withAmbient = async (
    ambient: IDBFactory | undefined,
    body: () => Promise<void>
  ) => {
    const globals = globalThis as { indexedDB?: IDBFactory };
    const previous = globals.indexedDB;
    if (ambient === undefined) delete globals.indexedDB;
    else globals.indexedDB = ambient;

    try {
      await body();
    } finally {
      globals.indexedDB = previous;
    }
  };

  it('reports Unavailable when there is no IndexedDB to use', async () => {
    expect.hasAssertions();
    // Every other test injects a factory, so the ambient-lookup branch never ran.
    // Cana has no fallback store by design — this is terminal, not degraded — so
    // the message a user sees here is the whole of the diagnosis.
    await withAmbient(undefined, async () => {
      const failure = await openDatabase({ name: 'no-idb', schema: schema() })
        .catch((error: unknown) => error);

      expect(isCanaErrorCode(failure, 'Unavailable')).toBe(true);
      expect((failure as { message: string }).message).toContain('no fallback');
    });
  });

  it('uses the ambient IndexedDB when no factory is injected', async () => {
    expect.hasAssertions();
    // The other half. Without it, the branch above would be satisfied by an
    // engine that never consults `globalThis` at all.
    await withAmbient(freshFactory(), async () => {
      const result = await openDatabase({ name: `ambient-${Date.now()}`, schema: schema() });

      expect(result.database.version).toBe(1);
      result.database.close();
    });
  });

  it('rejects a schema that declares no stores, before opening anything', async () => {
    expect.hasAssertions();
    // Validation runs first, so the `names.length === 0` guard deeper in
    // first-run detection is unreachable from here — it protects
    // `isDatabaseEmpty` against a pre-existing database whose stores were
    // removed outside Cana, which no test can construct through this API.
    //
    // Asserting the reachable contract instead: an empty schema is refused with
    // a message that names the problem, rather than opening a database that can
    // hold nothing.
    const failure = await openDatabase({
      name: `storeless-${Date.now()}`,
      schema: schema({ stores: [] }),
      factory: freshFactory()
    }).catch((error: unknown) => error);

    expect(isCanaErrorCode(failure, 'InvalidRequest')).toBe(true);
    expect((failure as { message: string }).message).toContain('declares no stores');
  });
});

/**
 * A schema that cannot be applied.
 *
 * `onupgradeneeded` runs inside a `versionchange` transaction. If applying the
 * schema throws there and nothing aborts, IndexedDB commits whatever was created
 * before the failure and the open resolves — a database at the new version with
 * a partially applied schema, and no error anywhere.
 *
 * These tests do not reach that abort path, and it is worth saying so rather
 * than implying otherwise: `validateSchema` rejects a malformed schema before
 * any database is opened, so the runtime handler is unreachable through this
 * API. What is asserted here is the layer that actually fires — rejection with
 * `InvalidRequest`, and no half-created database left behind.
 *
 * The in-transaction abort remains uncovered. It guards against a failure the
 * validator cannot foresee, such as quota exhaustion partway through an upgrade,
 * which `fake-indexeddb` cannot produce. Real-browser conformance is JUM-417.
 */
describe('cana database upgrade failure', () => {
  it('rejects a schema it cannot apply, before opening a database', async () => {
    expect.hasAssertions();
    // `multiEntry` on a compound keyPath is forbidden by the IndexedDB spec, and
    // `validateSchema` rejects it before opening anything.
    const factory = freshFactory();
    const name = `upgrade-fail-${Date.now()}`;

    const failure = await openDatabase({
      name,
      schema: {
        version: 1,
        stores: [{
          name: 'designs',
          keyPath: 'id',
          indexes: [{ name: 'bad', keyPath: ['a', 'b'], multiEntry: true }]
        }]
      },
      factory
    }).catch((error: unknown) => error);

    expect(failure).toBeDefined();
    expect((failure as { canaError?: boolean }).canaError).toBe(true);
  });

  it('leaves no database behind when the schema was rejected', async () => {
    expect.hasAssertions();
    // The consequence that matters: a rejected open must not have created
    // anything. If it had, the next open would find a database at version 1 with
    // nothing to upgrade and report success over a schema that was never applied.
    const factory = freshFactory();
    const name = `upgrade-fail-clean-${Date.now()}`;

    await openDatabase({
      name,
      schema: {
        version: 1,
        stores: [{
          name: 'designs',
          keyPath: 'id',
          indexes: [{ name: 'bad', keyPath: ['a', 'b'], multiEntry: true }]
        }]
      },
      factory
    }).catch(() => undefined);

    // Reopening with a valid schema must still see a first run to perform.
    const retry = await openDatabase({ name, schema: schema(), factory });

    expect(retry.upgraded).toBe(true);
    expect([...retry.database.objectStoreNames]).toStrictEqual(['designs']);
    retry.database.close();
  });
});
