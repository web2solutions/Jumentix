/**
 * localStorage fallback (JUM-615).
 *
 * When IndexedDB cannot open, Client degrades to an explicit localStorage
 * backend. These tests force that path and exercise the surface production
 * callers rely on.
 */

import {
  createClient,
  isCanaErrorCode,
  openLocalStorageBackend,
  type CanaSchema
} from '../src';
import { rejection, uniqueName } from './harness';

interface Design { id: number; name: string; owner?: string }

const schema = (): CanaSchema => ({
  version: 1,
  stores: [
    { name: 'designs', keyPath: 'id', indexes: [{ name: 'byOwner', keyPath: 'owner' }] },
    { name: 'notes', autoIncrement: true }
  ]
});

/** In-memory localStorage stand-in so tests do not share origin state. */
function memoryStorage() {
  const bag = new Map<string, string>();
  return {
    getItem: (key: string) => (bag.has(key) ? bag.get(key)! : null),
    removeItem: (key: string) => { bag.delete(key); },
    setItem: (key: string, value: string) => { bag.set(key, String(value)); }
  };
}

/**
 * Remove the ambient IndexedDB so `resolveFactory` throws `Unavailable`.
 * That is the client-open condition that activates the localStorage fallback.
 */
async function withoutIndexedDb<T>(body: () => Promise<T>): Promise<T> {
  const globals = globalThis as { indexedDB?: IDBFactory };
  const previous = globals.indexedDB;
  delete globals.indexedDB;
  try {
    return await body();
  } finally {
    if (previous === undefined) delete globals.indexedDB;
    else globals.indexedDB = previous;
  }
}

describe('cana localStorage fallback', () => {
  it('opens on localStorage when IndexedDB is Unavailable', async () => {
    await withoutIndexedDb(async () => {
      const client = createClient({
        name: uniqueName('ls-open'),
        schema: schema(),
        localStorage: memoryStorage()
      });

      await client.open();
      expect(client.backend).to.equal('localStorage');

      await client.table<Design>('designs').put({ id: 1, name: 'alpha', owner: 'ana' });
      const rows = await client.table<Design>('designs').query();
      expect(rows).to.deep.equal([{ id: 1, name: 'alpha', owner: 'ana' }]);

      const health = await client.durabilityAssessment();
      expect(health.level).to.equal('best-effort');
      expect(health.evictionDetectable).to.equal(false);

      const state = await client.storageState();
      expect(state.evicted).to.equal(false);
      expect(state.quotaBytes).to.equal(5 * 1024 * 1024);

      const dump = await client.exportAll();
      expect(dump.designs).to.have.length(1);

      await client.close();
      expect(client.backend).to.equal(undefined);
    });
  });

  it('stays terminal when fallback is disabled', async () => {
    await withoutIndexedDb(async () => {
      const client = createClient({
        name: uniqueName('ls-off'),
        schema: schema(),
        fallback: false,
        localStorage: memoryStorage()
      });

      const failure = await rejection(client.open());
      expect(isCanaErrorCode(failure, 'Unavailable')).to.equal(true);
    });
  });

  it('stays Unavailable when both IndexedDB and localStorage fail', async () => {
    await withoutIndexedDb(async () => {
      const client = createClient({
        name: uniqueName('ls-both'),
        schema: schema(),
        localStorage: {
          getItem: () => { throw new Error('private mode'); },
          setItem: () => { throw new Error('private mode'); },
          removeItem: () => { throw new Error('private mode'); }
        }
      });

      const failure = await rejection(client.open());
      expect(isCanaErrorCode(failure, 'Unavailable')).to.equal(true);
    });
  });

  it('supports CRUD, query, abort, bulk and ledger resolveWrite', async () => {
    await withoutIndexedDb(async () => {
      const storage = memoryStorage();
      const name = uniqueName('ls-crud');
      const client = createClient({
        name,
        schema: schema(),
        localStorage: storage,
        operationLedger: true
      });
      await client.open();

      const events: string[] = [];
      const stop = client.subscribe((event) => { events.push(event.type); });

      await client.table<Design>('designs').add({ id: 1, name: 'one', owner: 'a' });
      await client.table<Design>('designs').put({ id: 1, name: 'one-b', owner: 'a' });
      await client.table<Design>('designs').update(1, { name: 'one-c' });
      await client.table<Design>('designs').bulkAdd([
        { id: 2, name: 'two', owner: 'b' },
        { id: 3, name: 'three', owner: 'a' }
      ]);
      await client.table<Design>('designs').bulkPut([{ id: 3, name: 'three-b', owner: 'a' }]);

      const byOwner = await client.table<Design>('designs').query({ index: 'byOwner', equals: 'a' });
      expect(byOwner.map((row) => row.id).sort()).to.deep.equal([1, 3]);
      expect(await client.table<Design>('designs').count()).to.equal(3);

      const explained = await client.table<Design>('designs').explain({ limit: 1 });
      expect(explained.plan.fullScan).to.equal(true);
      expect(explained.records).to.have.length(1);

      const aborted = await client.transaction('readwrite', ['designs'], async (scope) => {
        await scope.table<Design>('designs').put({ id: 99, name: 'ghost' });
        scope.abort('nope');
        return null;
      });
      expect(aborted.outcome).to.equal('rolled-back');
      expect(await client.table<Design>('designs').get(99)).to.equal(undefined);

      const committed = await client.transaction('readwrite', ['designs'], async (scope) => {
        await scope.table<Design>('designs').delete(2);
        return 'ok';
      });
      expect(committed.outcome).to.equal('committed');
      expect(await client.resolveWrite(committed.correlationId, committed.attemptedAt))
        .to.equal('committed');

      await client.table<Design>('designs').bulkDelete([3]);
      await client.table<Design>('designs').clear();
      expect(await client.table<Design>('designs').count()).to.equal(0);

      const note = await client.table<{ text: string }, number>('notes').add({ text: 'hello' });
      expect(typeof note.key).to.equal('number');

      stop();
      expect(events.length).to.be.greaterThan(0);
      await client.close();

      const again = createClient({
        name,
        schema: schema(),
        localStorage: storage,
        operationLedger: true
      });
      await again.open();
      expect(again.backend).to.equal('localStorage');
      expect(await again.table<{ text: string }>('notes').count()).to.equal(1);
      await again.close();
    });
  });

  it('maps quota failures on persist', async () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        const error = new Error('exceeded');
        error.name = 'QuotaExceededError';
        throw error;
      },
      removeItem: () => undefined
    };
    const backend = openLocalStorageBackend({
      name: uniqueName('ls-quota'),
      schema: schema(),
      storage,
      originId: 'test',
      nextCursor: () => 1
    });
    const failure = await rejection(backend.transaction(
      'readwrite',
      ['designs'],
      async (scope) => {
        await scope.table<Design>('designs').put({ id: 1, name: 'x' });
        return null;
      },
      'c:1'
    ));
    expect(isCanaErrorCode(failure, 'QuotaExceeded')).to.equal(true);
  });

  it('prefers IndexedDB when it opens successfully', async () => {
    const client = createClient({
      name: uniqueName('ls-prefer-idb'),
      schema: schema(),
      localStorage: memoryStorage()
    });
    await client.open();
    expect(client.backend).to.equal('indexeddb');
    await client.table<Design>('designs').put({ id: 1, name: 'idb' });
    expect(await client.table<Design>('designs').get(1)).to.deep.equal({ id: 1, name: 'idb' });
    await client.close();
  });
});

describe('cana localStorage fallback edge coverage', () => {
  it('uses the browser localStorage when none is injected', async () => {
    await withoutIndexedDb(async () => {
      const name = uniqueName('ls-browser');
      const client = createClient({ name, schema: schema() });
      await client.open();
      expect(client.backend).to.equal('localStorage');
      await client.table<Design>('designs').put({ id: 7, name: 'browser-ls' });
      await client.close();

      const again = createClient({ name, schema: schema() });
      await again.open();
      expect(await again.table<Design>('designs').get(7)).to.deep.equal({ id: 7, name: 'browser-ls' });
      await again.close();
      localStorage.removeItem(`cana.ls.v1:${name}`);
    });
  });

  it('upgrades schema version, rejects downgrade, rejects corrupt payloads', async () => {
    const storage = memoryStorage();
    const name = uniqueName('ls-upgrade');
    const v1 = openLocalStorageBackend({
      name,
      schema: { version: 1, stores: [{ name: 'designs', keyPath: 'id' }] },
      storage,
      originId: 'o',
      nextCursor: () => 1
    });
    await v1.transaction('readwrite', ['designs'], async (scope) => {
      await scope.table<Design>('designs').put({ id: 1, name: 'v1' });
      return null;
    }, 'c:1');
    v1.close();

    const v2 = openLocalStorageBackend({
      name,
      schema: {
        version: 2,
        stores: [
          { name: 'designs', keyPath: 'id' },
          { name: 'extras', keyPath: 'id' }
        ]
      },
      storage,
      originId: 'o',
      nextCursor: () => 2
    });
    expect(await v2.exportAll()).to.have.property('extras');
    v2.close();

    const downgrade = (() => {
      try {
        return openLocalStorageBackend({
          name,
          schema: { version: 1, stores: [{ name: 'designs', keyPath: 'id' }] },
          storage,
          originId: 'o',
          nextCursor: () => 3
        });
      } catch (error) {
        return error;
      }
    })();
    expect(isCanaErrorCode(downgrade, 'UpgradeFailed')).to.equal(true);

    storage.setItem(`cana.ls.v1:${uniqueName('ls-corrupt')}`, '{not-json');
    const corrupt = (() => {
      try {
        return openLocalStorageBackend({
          name: uniqueName('ls-corrupt-open'),
          schema: schema(),
          storage: {
            getItem: () => '{not-json',
            setItem: () => undefined,
            removeItem: () => undefined
          },
          originId: 'o',
          nextCursor: () => 1
        });
      } catch (error) {
        return error;
      }
    })();
    expect(isCanaErrorCode(corrupt, 'Internal')).to.equal(true);
  });

  it('covers outbound keys, nested keyPaths, ranges, distinct and readonly guards', async () => {
    const storage = memoryStorage();
    const backend = openLocalStorageBackend({
      name: uniqueName('ls-edges'),
      schema: {
        version: 1,
        stores: [
          { name: 'outbound' },
          {
            name: 'nested',
            keyPath: 'meta.id',
            autoIncrement: true,
            indexes: [{ name: 'byTag', keyPath: 'tag' }]
          },
          {
            name: 'compound',
            keyPath: ['owner', 'id'],
            indexes: [{ name: 'byOwner', keyPath: 'owner' }]
          }
        ]
      },
      storage,
      originId: 'o',
      nextCursor: () => 1,
      operationLedger: true
    });

    await backend.transaction('readwrite', ['outbound', 'nested', 'compound'], async (scope) => {
      await scope.table<{ text: string }, string>('outbound').add({ text: 'a' }, 'k1');
      await scope.table<{ text: string }, string>('outbound').put({ text: 'b' }, 'k1');
      const nested = await scope.table<{ meta?: { id?: number }; tag: string }>('nested')
        .add({ tag: 't', meta: {} as { id?: number } });
      expect(typeof nested.key).to.equal('number');
      await scope.table<{ owner: string; id: number; label: string }>('compound').put({
        owner: 'ana',
        id: 1,
        label: 'one'
      });
      await scope.table<{ owner: string; id: number; label: string }>('compound').put({
        owner: 'ana',
        id: 2,
        label: 'two'
      });
      await scope.table<{ owner: string; id: number; label: string }>('compound').put({
        owner: 'bob',
        id: 1,
        label: 'bob'
      });
      return null;
    }, 'c:write');

    const ranged = await backend.transaction('readonly', ['compound'], async (scope) => (
      scope.table('compound').query({
        index: 'byOwner',
        range: { lower: 'ana', upper: 'ana' },
        direction: 'prev',
        distinct: true
      })
    ), 'c:read');
    expect(ranged.outcome).to.equal('committed');

    const readonlyWrite = await rejection(backend.transaction(
      'readonly',
      ['outbound'],
      async (scope) => scope.table<{ text: string }, string>('outbound').put({ text: 'nope' }, 'k2'),
      'c:ro'
    ));
    expect(isCanaErrorCode(readonlyWrite, 'InvalidRequest')).to.equal(true);

    const missingKey = await rejection(backend.transaction(
      'readwrite',
      ['outbound'],
      async (scope) => scope.table<{ text: string }, string>('outbound').add({ text: 'x' }),
      'c:nokey'
    ));
    expect(isCanaErrorCode(missingKey, 'InvalidRequest')).to.equal(true);

    const duplicate = await rejection(backend.transaction(
      'readwrite',
      ['outbound'],
      async (scope) => scope.table<{ text: string }, string>('outbound').add({ text: 'dup' }, 'k1'),
      'c:dup'
    ));
    expect(isCanaErrorCode(duplicate, 'ConstraintViolation')).to.equal(true);

    const badIndex = await rejection(backend.transaction(
      'readonly',
      ['compound'],
      async (scope) => scope.table('compound').query({ index: 'nope' }),
      'c:idx'
    ));
    expect(isCanaErrorCode(badIndex, 'InvalidRequest')).to.equal(true);

    const updateMissing = await rejection(backend.transaction(
      'readwrite',
      ['outbound'],
      async (scope) => scope.table<{ text: string }, string>('outbound').update('missing', { text: 'z' }),
      'c:upd'
    ));
    expect(isCanaErrorCode(updateMissing, 'NotFound')).to.equal(true);

    const explicitOnInbound = await rejection(backend.transaction(
      'readwrite',
      ['compound'],
      async (scope) => scope.table('compound').add({ owner: 'x', id: 9 }, 1 as never),
      'c:explicit'
    ));
    expect(isCanaErrorCode(explicitOnInbound, 'InvalidRequest')).to.equal(true);

    expect(await backend.resolveWrite('nope', Date.now() - 10)).to.equal('rolled-back');
    expect(await backend.resolveWrite('nope', Date.now() - 10, { horizonMs: 1, now: Date.now() + 1000 }))
      .to.equal('unresolvable');

    backend.close();
    const closed = await rejection(backend.transaction(
      'readonly',
      ['outbound'],
      async (scope) => scope.table('outbound').query(),
      'c:closed'
    ));
    expect(isCanaErrorCode(closed, 'InvalidRequest')).to.equal(true);
  });

  it('maps non-quota persist failures and private-mode browser storage', async () => {
    const refused = {
      getItem: () => null,
      setItem: () => { throw new Error('denied'); },
      removeItem: () => undefined
    };
    const backend = openLocalStorageBackend({
      name: uniqueName('ls-denied'),
      schema: schema(),
      storage: refused,
      originId: 'o',
      nextCursor: () => 1
    });
    const failure = await rejection(backend.transaction(
      'readwrite',
      ['designs'],
      async (scope) => scope.table<Design>('designs').put({ id: 1, name: 'x' }),
      'c:1'
    ));
    expect(isCanaErrorCode(failure, 'Unavailable')).to.equal(true);

    // Inject a storage that refuses reads rather than mutating ambient
    // `localStorage.setItem` — Firefox (and some WebKit builds) expose setItem
    // as a non-writable host function, so assignment is a no-op and open would
    // succeed against a working store.
    await withoutIndexedDb(async () => {
      const client = createClient({
        name: uniqueName('ls-private'),
        schema: schema(),
        localStorage: {
          getItem: () => { throw new Error('private'); },
          setItem: () => { throw new Error('private'); },
          removeItem: () => undefined
        }
      });
      const openFailure = await rejection(client.open());
      expect(isCanaErrorCode(openFailure, 'Unavailable')).to.equal(true);
    });
  });

  it('deletes persisted fallback data', () => {
    const storage = memoryStorage();
    const name = uniqueName('ls-delete');
    const backend = openLocalStorageBackend({
      name,
      schema: schema(),
      storage,
      originId: 'o',
      nextCursor: () => 1
    });
    storage.setItem(`cana.ls.v1:${name}`, JSON.stringify({
      version: 1,
      stores: { designs: {}, notes: {} },
      sequences: { designs: 0, notes: 0 }
    }));
    backend.deletePersisted();
    expect(storage.getItem(`cana.ls.v1:${name}`)).to.equal(null);
  });
});
