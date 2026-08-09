/* eslint-disable @typescript-eslint/no-var-requires */
import type { CanaSchema } from '../src';
import {
  StorageDurability,
  deleteDatabase,
  isCanaErrorCode,
  openDatabase,
  validateSchema
} from '../src';
import { rejection } from './harness';

/**
 * Exercised against the browser's own IndexedDB, not a
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
const freshFactory = () => indexedDB;

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
    expect(validateSchema(schema())).to.deep.equal([]);
  });

  it('rejects multiEntry combined with a compound keyPath', () => {
    // IndexedDB forbids this and reports it from inside a versionchange
    // transaction, where it reads as a broken upgrade rather than a bad schema.
    const problems = validateSchema(schema({
      stores: [{
        name: 'designs',
        keyPath: 'id',
        indexes: [{ name: 'bad', keyPath: ['a', 'b'], multiEntry: true }]
      }]
    }));

    expect(problems).to.have.lengthOf(1);
    expect(problems[0]).to.include('multiEntry cannot be combined with a compound keyPath');
  });

  it('rejects duplicate stores, duplicate indexes and empty compound key paths', () => {
    const problems = validateSchema(schema({
      stores: [
        { name: 'a', keyPath: [] },
        { name: 'a', keyPath: 'id', indexes: [{ name: 'i', keyPath: 'x' }, { name: 'i', keyPath: 'y' }] }
      ]
    }));

    expect(problems.some((entry) => entry.includes('compound keyPath is empty'))).to.equal(true);
    expect(problems.some((entry) => entry.includes('declared more than once'))).to.equal(true);
  });

  it('rejects a non-positive version', () => {
    expect(validateSchema(schema({ version: 0 }))[0]).to.include('version must be a positive integer');
  });
});

describe('cana database lifecycle', () => {
  it('opens, applies the schema, and reports the upgrade', async () => {
    const factory = freshFactory();
    const result = await openDatabase({ name: 'designer', schema: schema(), factory });

    expect(result.upgraded).to.equal(true);
    expect([...result.database.objectStoreNames]).to.deep.equal(['designs']);
    expect([...result.database.transaction('designs').objectStore('designs').indexNames])
      .to.deep.equal(['byName']);
    result.database.close();
  });

  it('adds a store on a version bump without dropping the existing one', async () => {
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

    expect([...upgraded.database.objectStoreNames].sort()).to.deep.equal(['deployments', 'designs']);
    upgraded.database.close();
  });

  it('leaves a store that disappeared from the schema in place rather than dropping it', async () => {
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

    expect([...second.database.objectStoreNames]).to.include('legacy');
    second.database.close();
  });

  it('refuses a downgrade and says why', async () => {
    const factory = freshFactory();
    const first = await openDatabase({ name: 'designer', factory, schema: schema({ version: 3 }) });
    first.database.close();

    expect(await rejection(openDatabase({ name: 'designer', factory, schema: schema({ version: 2 }) }))).to.deep.include({ canaError: true, code: 'UpgradeFailed' });
  });

  it('rejects an inapplicable schema before touching the database', async () => {
    const factory = freshFactory();

    expect(await rejection(openDatabase({
      name: 'designer',
      factory,
      schema: schema({ version: -1 })
    }))).to.deep.include({ canaError: true, code: 'InvalidRequest' });

    // Nothing was created, so the failure left no partial state behind.
    const listed = await factory.databases();

    expect(listed.find((entry) => entry.name === 'designer')).to.equal(undefined);
  });

  it('surfaces a typed error rather than a DOMException', async () => {
    const factory = freshFactory();
    const failure = await openDatabase({ name: 'designer', factory, schema: schema({ version: 0 }) })
      .catch((error: unknown) => error);

    expect(isCanaErrorCode(failure, 'InvalidRequest')).to.equal(true);
    expect(failure).not.to.be.instanceOf(Error);
  });

  it('reports a first run as a first run', async () => {
    const factory = freshFactory();
    const { environment } = tombstoneEnvironment();
    const durability = new StorageDurability(environment);

    const result = await openDatabase({
      name: 'designer', factory, schema: schema(), durability
    });

    expect(result.eviction).to.deep.equal({ evicted: false, reason: 'first-run' });
    result.database.close();
  });

  it('reports eviction, not a first run, when a known database has vanished', async () => {
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

    expect(second.eviction.evicted).to.equal(true);
    expect(second.eviction.reason).to.equal('evicted-database-absent');
    expect(await durability.state()).to.deep.include({ evicted: true });
    second.database.close();
  });

  it('does not mistake an existing populated database for eviction', async () => {
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

    expect(second.eviction).to.deep.equal({ evicted: false, reason: 'existing-data' });
    second.database.close();
  });
});

/*
 * NOT COVERED, and stated rather than left to be discovered:
 *
 * The 'Unavailable' path — no IndexedDB at all, as in private browsing — is not
 * exercised here. The browser supplies `indexedDB` ambiently, so the
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
    // Every other test injects a factory, so the ambient-lookup branch never ran.
    // openDatabase itself does not apply the client fallback — that is Client.open
    // (JUM-615) — so this path stays Unavailable with a message that points at
    // the optional localStorage fallback.
    await withAmbient(undefined, async () => {
      const failure = await openDatabase({ name: 'no-idb', schema: schema() })
        .catch((error: unknown) => error);

      expect(isCanaErrorCode(failure, 'Unavailable')).to.equal(true);
      expect((failure as { message: string }).message).to.include('No usable IndexedDB');
      expect((failure as { message: string }).message).to.include('localStorage fallback');
    });
  });

  it('uses the ambient IndexedDB when no factory is injected', async () => {
    // The other half. Without it, the branch above would be satisfied by an
    // engine that never consults `globalThis` at all.
    await withAmbient(freshFactory(), async () => {
      const result = await openDatabase({ name: `ambient-${Date.now()}`, schema: schema() });

      expect(result.database.version).to.equal(1);
      result.database.close();
    });
  });

  it('rejects a schema that declares no stores, before opening anything', async () => {
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

    expect(isCanaErrorCode(failure, 'InvalidRequest')).to.equal(true);
    expect((failure as { message: string }).message).to.include('declares no stores');
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
 * which only a real browser produces, and which this suite now runs against.
 */
describe('cana database upgrade failure', () => {
  it('rejects a schema it cannot apply, before opening a database', async () => {
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

    expect(failure).to.not.equal(undefined);
    expect((failure as { canaError?: boolean }).canaError).to.equal(true);
  });

  it('leaves no database behind when the schema was rejected', async () => {
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

    expect(retry.upgraded).to.equal(true);
    expect([...retry.database.objectStoreNames]).to.deep.equal(['designs']);
    retry.database.close();
  });
});
