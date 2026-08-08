/**
 * Remaining Istanbul gaps for a clean 100% report on packages/cana/src (JUM-615).
 *
 * Prefer extending behaviour suites when a gap is product-shaped; this file
 * only exists for the defensive / late-timer / injected-storage arms that no
 * green path reaches.
 */

import type { CanaSchema } from '../src';
import {
  canaError,
  createClient,
  createRouter,
  createWorkerHost,
  deleteDatabase,
  isCanaError,
  isCanaErrorCode,
  openDatabase,
  openLocalStorageBackend,
  requestToPromise,
  resolveOutcome,
  runConformance,
  serve,
  StorageDurability,
  type CanaResponseEnvelope
} from '../src';
import { rejection, uniqueName } from './harness';

const schema = (): CanaSchema => ({
  version: 1,
  stores: [{ name: 'designs', keyPath: 'id' }]
});

function memoryStorage() {
  const bag = new Map<string, string>();
  return {
    getItem: (key: string) => (bag.has(key) ? bag.get(key)! : null),
    removeItem: (key: string) => { bag.delete(key); },
    setItem: (key: string, value: string) => { bag.set(key, String(value)); },
    bag
  };
}

function fakePort() {
  const listeners: ((event: { data: unknown }) => void)[] = [];
  const sent: Record<string, unknown>[] = [];
  return {
    sent,
    reply(requestId: string, response: Partial<CanaResponseEnvelope>) {
      const message = { requestId, ok: true, ...response };
      listeners.forEach((listener) => listener({ data: message }));
    },
    port: {
      postMessage(message: unknown) {
        sent.push(message as Record<string, unknown>);
      },
      addEventListener(_type: 'message', listener: (event: { data: unknown }) => void) {
        listeners.push(listener);
      },
      removeEventListener(_type: 'message', listener: (event: { data: unknown }) => void) {
        const at = listeners.indexOf(listener);
        if (at >= 0) listeners.splice(at, 1);
      }
    }
  };
}

describe('cana 100% coverage — localStorage backend edges', () => {
  it('refuses to open when ambient localStorage is missing', async () => {
    const globals = globalThis as { localStorage?: Storage };
    const previous = globals.localStorage;
    // @ts-expect-error deliberate deletion for Unavailable path
    delete globals.localStorage;
    try {
      const failure = await rejection(Promise.resolve().then(() => openLocalStorageBackend({
        name: uniqueName('no-ls'),
        schema: schema(),
        originId: 'o',
        nextCursor: () => 1
      })));
      expect(isCanaErrorCode(failure, 'Unavailable')).to.equal(true);
    } finally {
      globals.localStorage = previous!;
    }
  });

  it('covers compound compare, open ranges, nested paths and ledger-off resolve', async () => {
    const storage = memoryStorage();
    const backend = openLocalStorageBackend({
      name: uniqueName('ls-100'),
      schema: {
        version: 1,
        stores: [
          {
            name: 'compound',
            keyPath: ['owner', 'id'],
            indexes: [{ name: 'byOwner', keyPath: 'owner' }]
          },
          {
            name: 'nested',
            keyPath: 'meta.id',
            autoIncrement: true
          },
          { name: 'inbound', keyPath: 'id' },
          { name: 'outbound' }
        ]
      },
      storage,
      originId: 'o',
      nextCursor: () => 1
    });

    await backend.transaction('readwrite', ['compound', 'nested', 'inbound'], async (scope) => {
      await scope.table('compound').put({ owner: 'ana', id: 1, label: 'a1' });
      await scope.table('compound').put({ owner: 'ana', id: 2, label: 'a2' });
      await scope.table('compound').put({ owner: 'bob', id: 1, label: 'b1' });
      // Nested autoIncrement creates the missing parent object.
      const nested = await scope.table('nested').add({ tag: 't' } as never);
      expect(typeof nested.key).to.equal('number');
      await scope.table('inbound').put({ id: 1, name: 'ok' });
      return null;
    }, 'c:seed');

    // Compound primary-key range with open bounds + reverse length mismatch via query sort.
    const ranged = await backend.transaction('readonly', ['compound'], async (scope) => (
      scope.table('compound').query({
        range: { lower: ['ana', 1], upper: ['ana', 9], lowerOpen: true, upperOpen: true },
        direction: 'prev'
      })
    ), 'c:range');
    expect(ranged.outcome).to.equal('committed');

    // Nested index path through a non-object mid-node (readPath early return).
    const nestedStorage = memoryStorage();
    const nestedName = uniqueName('ls-nested-mid');
    nestedStorage.setItem(`cana.ls.v1:${nestedName}`, JSON.stringify({
      version: 1,
      stores: { nested: { '1': { meta: null, tag: 't' } } },
      sequences: { nested: 1 }
    }));
    const nestedBackend = openLocalStorageBackend({
      name: nestedName,
      schema: {
        version: 1,
        stores: [{
          name: 'nested',
          keyPath: 'meta.id',
          indexes: [{ name: 'byDeep', keyPath: 'meta.tag' }]
        }]
      },
      storage: nestedStorage,
      originId: 'o',
      nextCursor: () => 1
    });
    const midPath = await nestedBackend.transaction('readonly', ['nested'], async (scope) => (
      scope.table('nested').query({ index: 'byDeep', equals: 't' })
    ), 'c:mid');
    expect(midPath.outcome).to.equal('committed');
    nestedBackend.close();

    const missingInbound = await rejection(backend.transaction(
      'readwrite',
      ['inbound'],
      async (scope) => scope.table('inbound').put({ name: 'no-id' } as never),
      'c:noid'
    ));
    expect(isCanaErrorCode(missingInbound, 'InvalidRequest')).to.equal(true);

    const explicitPut = await rejection(backend.transaction(
      'readwrite',
      ['inbound'],
      async (scope) => scope.table('inbound').put({ id: 2, name: 'x' }, 2 as never),
      'c:explicit-put'
    ));
    expect(isCanaErrorCode(explicitPut, 'InvalidRequest')).to.equal(true);

    const unknownStore = await rejection(backend.transaction(
      'readonly',
      ['nope'],
      async (scope) => scope.table('nope').query(),
      'c:unknown'
    ));
    expect(isCanaErrorCode(unknownStore, 'InvalidRequest')).to.equal(true);

    // Delete a missing key (present=false arm) and an existing one (record arm).
    await backend.transaction('readwrite', ['inbound', 'outbound'], async (scope) => {
      await scope.table('inbound').put({ id: 99, name: 'gone' });
      await scope.table('inbound').delete(99);
      await scope.table('outbound').delete('missing');
      scope.abort();
      return null;
    }, 'c:abort').catch(() => undefined);

    // Open ranges with only a lower or only an upper bound.
    const lowerOnly = await backend.transaction('readonly', ['compound'], async (scope) => (
      scope.table('compound').query({ range: { lower: ['bob', 0], lowerOpen: false } })
    ), 'c:lower');
    expect(lowerOnly.outcome).to.equal('committed');
    const upperOnly = await backend.transaction('readonly', ['compound'], async (scope) => (
      scope.table('compound').query({ range: { upper: ['bob', 9], upperOpen: true } })
    ), 'c:upper');
    expect(upperOnly.outcome).to.equal('committed');

    // Compound keyPath with a missing part.
    const compoundGap = await rejection(backend.transaction(
      'readwrite',
      ['compound'],
      async (scope) => scope.table('compound').put({ owner: 'ana' } as never),
      'c:compound-gap'
    ));
    expect(isCanaErrorCode(compoundGap, 'InvalidRequest')).to.equal(true);

    // operationLedger resolveWrite when the ledger bag is absent from the snapshot.
    const ledgerName = uniqueName('ls-ledger');
    const ledgerBackend = openLocalStorageBackend({
      name: ledgerName,
      schema: {
        version: 1,
        stores: [
          { name: 'compound', keyPath: ['owner', 'id'] },
          { name: 'nested', keyPath: 'meta.id', autoIncrement: true },
          { name: 'inbound', keyPath: 'id' },
          { name: 'outbound' }
        ]
      },
      storage: memoryStorage(),
      operationLedger: true,
      originId: 'o',
      nextCursor: () => 1
    });
    const ledgerInternal = ledgerBackend as unknown as {
      snapshot: { stores: Record<string, Record<string, unknown>> };
    };
    delete ledgerInternal.snapshot.stores.__cana_operations;
    expect(await ledgerBackend.resolveWrite('missing', Date.now())).to.equal('rolled-back');
    ledgerBackend.close();

    // exportAll when a schema store bag is missing from the live snapshot.
    const exportBackend = openLocalStorageBackend({
      name: uniqueName('ls-export'),
      schema: {
        version: 1,
        stores: [{ name: 'designs', keyPath: 'id' }, { name: 'extra', keyPath: 'id' }]
      },
      storage: memoryStorage(),
      originId: 'o',
      nextCursor: () => 1
    });
    const exportInternal = exportBackend as unknown as {
      snapshot: { stores: Record<string, Record<string, unknown>> };
    };
    delete exportInternal.snapshot.stores.extra;
    expect(Object.keys(await exportBackend.exportAll())).to.include('extra');
    exportBackend.close();

    // Sequences already non-zero and compound autoIncrement keyPath false arm.
    const seqName = uniqueName('ls-seq');
    const seqStorage = memoryStorage();
    seqStorage.setItem(`cana.ls.v1:${seqName}`, JSON.stringify({
      version: 1,
      stores: {
        keyed: {},
        compoundGen: {},
        outboundGen: {}
      },
      sequences: { keyed: 2, compoundGen: 1, outboundGen: 3 }
    }));
    const seqBackend = openLocalStorageBackend({
      name: seqName,
      schema: {
        version: 1,
        stores: [
          { name: 'keyed', keyPath: 'id', autoIncrement: true },
          { name: 'compoundGen', keyPath: ['tenant', 'id'], autoIncrement: true },
          { name: 'outboundGen', autoIncrement: true }
        ]
      },
      storage: seqStorage,
      originId: 'o',
      nextCursor: () => 1
    });
    await seqBackend.transaction('readwrite', ['keyed', 'compoundGen', 'outboundGen'], async (scope) => {
      await scope.table('keyed').add({ label: 'a' } as never);
      await scope.table('compoundGen').add({ tenant: 't1' } as never);
      await scope.table('outboundGen').add({ label: 'b' } as never);
      return null;
    }, 'c:seq');
    seqBackend.close();

    expect(await backend.resolveWrite('any', Date.now())).to.equal('unresolvable');

    // Queue continuation after a rejected transaction (internal queue rejection).
    const internal = backend as unknown as { queue: Promise<unknown> };
    internal.queue = Promise.reject(new Error('prior queue link rejected'));
    await backend.transaction(
      'readwrite',
      ['inbound'],
      async () => { throw new Error('boom'); },
      'c:boom'
    ).catch(() => undefined);
    const after = await backend.transaction(
      'readonly',
      ['inbound'],
      async (scope) => scope.table('inbound').get(1),
      'c:after'
    );
    expect(after.outcome).to.equal('committed');

    backend.close();
  });

  it('rejects malformed and upgraded snapshots, and non-Error persist failures', async () => {
    const storage = memoryStorage();
    const name = uniqueName('ls-snap');
    storage.setItem(`cana.ls.v1:${name}`, JSON.stringify({ version: 'x', stores: null }));
    const corrupt = await rejection(Promise.resolve().then(() => openLocalStorageBackend({
      name,
      schema: schema(),
      storage,
      originId: 'o',
      nextCursor: () => 1
    })));
    expect(isCanaErrorCode(corrupt, 'Internal')).to.equal(true);

    const name2 = uniqueName('ls-up');
    storage.setItem(`cana.ls.v1:${name2}`, JSON.stringify({
      version: 1,
      stores: { designs: {} },
      sequences: { designs: 0 }
    }));
    const upgraded = openLocalStorageBackend({
      name: name2,
      schema: { version: 2, stores: [{ name: 'designs', keyPath: 'id' }, { name: 'extra', keyPath: 'id' }] },
      storage,
      originId: 'o',
      nextCursor: () => 1
    });
    upgraded.close();

    const throwsString = {
      getItem: () => null,
      setItem: () => { throw 'quota-string'; },
      removeItem: () => undefined
    };
    const backend = openLocalStorageBackend({
      name: uniqueName('ls-str'),
      schema: schema(),
      storage: throwsString,
      originId: 'o',
      nextCursor: () => 1
    });
    const failure = await rejection(backend.transaction(
      'readwrite',
      ['designs'],
      async (scope) => scope.table('designs').put({ id: 1 }),
      'c:str'
    ));
    expect(isCanaErrorCode(failure, 'QuotaExceeded')).to.equal(true);
  });

  it('notifies rolled-back hooks on localStorage transaction failure', async () => {
    const seen: string[] = [];
    const globals = globalThis as { indexedDB?: IDBFactory };
    const previous = globals.indexedDB;
    delete globals.indexedDB;
    try {
      const client = createClient({
        name: uniqueName('ls-hooks'),
        schema: schema(),
        localStorage: memoryStorage(),
        hooks: {
          afterRollback: (_outcome, reason) => { seen.push(reason ?? 'none'); }
        }
      });
      await client.open();
      await rejection(client.transaction('readwrite', ['designs'], async () => {
        throw new Error('plain');
      }));
      await rejection(client.transaction('readwrite', ['designs'], async () => {
        throw canaError('InvalidRequest', 'typed');
      }));
      // Non-Cana throws pass `undefined` as the reason; Cana errors pass `.message`.
      expect(seen).to.deep.equal(['none', 'typed']);
      await client.close();
    } finally {
      if (previous === undefined) delete globals.indexedDB;
      else globals.indexedDB = previous;
    }
  });
});

describe('cana 100% coverage — open/delete timers and client guards', () => {
  it('ignores a blocked timer that fires after open already succeeded', async () => {
    const name = uniqueName('open-settle');
    const request = {
      onsuccess: null as (() => void) | null,
      onerror: null as (() => void) | null,
      onupgradeneeded: null as (() => void) | null,
      onblocked: null as (() => void) | null,
      result: undefined as unknown,
      error: null as DOMException | null,
      transaction: null as unknown
    };
    const factory = {
      open: () => {
        setTimeout(() => {
          request.onblocked?.();
          request.result = { objectStoreNames: { contains: () => true }, close: () => undefined };
          request.onsuccess?.();
        }, 0);
        return request;
      },
      databases: async () => []
    } as unknown as IDBFactory;

    const opened = await openDatabase({
      name,
      schema: schema(),
      factory,
      blockedTimeoutMs: 30
    });
    await new Promise((resolve) => { setTimeout(resolve, 50); });
    opened.database.close();
  });

  it('ignores a blocked timer that fires after delete already succeeded', async () => {
    const name = uniqueName('del-settle');
    const request = {
      onsuccess: null as (() => void) | null,
      onerror: null as (() => void) | null,
      result: undefined as unknown,
      error: null as DOMException | null
    };
    const factory = {
      deleteDatabase: () => {
        setTimeout(() => { request.onsuccess?.(); }, 0);
        return request;
      }
    } as unknown as IDBFactory;

    await deleteDatabase(name, { factory, blockedTimeoutMs: 30 });
    await new Promise((resolve) => { setTimeout(resolve, 50); });
  });

  it('ignores late delete success after blocked timeout already rejected', async () => {
    const name = uniqueName('del-late');
    const request = {
      onsuccess: null as (() => void) | null,
      onerror: null as (() => void) | null,
      result: undefined as unknown,
      error: null as DOMException | null
    };
    const factory = {
      deleteDatabase: () => {
        setTimeout(() => { request.onsuccess?.(); }, 40);
        return request;
      }
    } as unknown as IDBFactory;

    const failure = await deleteDatabase(name, { factory, blockedTimeoutMs: 20 })
      .catch((error: unknown) => error);
    expect(isCanaErrorCode(failure, 'UpgradeBlocked')).to.equal(true);
    await new Promise((resolve) => { setTimeout(resolve, 60); });
  });

  it('prefers upgradeFailure on onerror over the request error', async () => {
    const name = uniqueName('open-onerror-upgrade');
    const request = {
      onsuccess: null as (() => void) | null,
      onerror: null as (() => void) | null,
      onupgradeneeded: null as (() => void) | null,
      onblocked: null as (() => void) | null,
      result: undefined as unknown,
      error: null as DOMException | null,
      transaction: null as unknown
    };
    const store = {
      objectStoreNames: { contains: () => false },
      createObjectStore: () => { throw new DOMException('refused', 'InvalidAccessError'); },
      close: () => undefined
    };
    const transaction = {
      abort: () => undefined,
      objectStore: () => { throw new DOMException('no store', 'NotFoundError'); }
    };
    const factory = {
      open: () => {
        setTimeout(() => {
          request.result = store;
          request.transaction = transaction;
          request.onupgradeneeded?.();
          request.error = new DOMException('secondary', 'UnknownError');
          request.onerror?.();
        }, 0);
        return request;
      },
      databases: async () => []
    } as unknown as IDBFactory;

    const failure = await openDatabase({ name, schema: schema(), factory })
      .catch((error: unknown) => error);
    expect(isCanaErrorCode(failure, 'InvalidRequest')).to.equal(true);
    expect((failure as { message: string }).message).to.include('refused');
  });

  it('leaves observedVersion undefined when databases() is missing and an upgrade ran', async () => {
    const real = indexedDB;
    const name = uniqueName('open-blind-upgrade');
    const first = await openDatabase({
      name,
      schema: schema(),
      factory: real
    });
    first.database.close();

    const blind = {
      open: (dbName: string, version?: number) => real.open(dbName, version),
      deleteDatabase: (dbName: string) => real.deleteDatabase(dbName),
      cmp: (left: unknown, right: unknown) => real.cmp(left, right),
      databases: undefined
    } as unknown as IDBFactory;

    const upgraded = await openDatabase({
      name,
      schema: { version: 2, stores: [{ name: 'designs', keyPath: 'id' }, { name: 'extra', keyPath: 'id' }] },
      factory: blind,
      durability: new StorageDurability({})
    });
    expect(upgraded.upgraded).to.equal(true);
    upgraded.database.close();
    await deleteDatabase(name, { factory: real });
  });

  it('rejects IndexedDB-only helpers when the IDB handle is gone', async () => {
    const client = createClient({ name: uniqueName('no-idb-handle'), schema: schema() });
    await client.open();
    const internal = client as unknown as { database?: IDBDatabase };
    // Keep the real handle so the suite afterEach is not left with an orphaned
    // connection that blocks `indexedDB.databases()` cleanup.
    const live = internal.database!;
    internal.database = undefined;
    const failure = await rejection(client.exportAll());
    expect(isCanaErrorCode(failure, 'InvalidRequest')).to.equal(true);
    live.close();
    internal.database = undefined;
    await client.close();
  });
});

describe('cana 100% coverage — protocol and conformance', () => {
  it('ignores a timeout that fires after the request already settled', async () => {
    const harness = fakePort();
    const router = createRouter({ port: harness.port, timeoutMs: 30 });
    const pending = router.send({ kind: 'get', store: 'a' });
    harness.reply(harness.sent[0].requestId as string, { result: 'fast' });
    expect(await pending).to.equal('fast');
    // Leave the router alive so the armed timer can fire and hit the settled guard.
    await new Promise((resolve) => { setTimeout(resolve, 50); });
    router.dispose();
  });

  it('covers resolveOutcome default options and canaError cause shapes', () => {
    expect(canaError('Internal', 'x', { cause: { message: 'only' } }).cause).to.equal('only');
    expect(canaError('Internal', 'x', { cause: { name: 'OnlyName' } }).cause).to.equal('OnlyName');
    expect(canaError('Internal', 'x', { cause: { name: 'Named', message: 'and messaged' } }).cause)
      .to.equal('Named: and messaged');
    expect(canaError('Internal', 'x', { cause: { other: true } }).cause).to.equal('[object Object]');
    const database = {
      objectStoreNames: { contains: () => false },
      transaction: () => { throw new Error('no ledger'); }
    } as unknown as IDBDatabase;
    return resolveOutcome(database, 'id', Date.now()).then((outcome) => {
      expect(outcome).to.equal('unresolvable');
    });
  });

  it('records a failure detail from a throw with no message property', async () => {
    const report = await runConformance({ label: 'detail-fallback' });
    const failed = report.results.find((result) => result.name === 'throw without message');
    expect(failed?.status).to.equal('failed');
    expect(failed?.detail).to.equal('[object Object]');
  });

  it('runs the aborted-transaction subscribe check from the harness', async () => {
    const report = await runConformance({ label: 'coverage-subscribe-abort' });
    const check = report.results.find((result) => result.name === 'emits no events for an aborted transaction');
    expect(check?.status).to.equal('passed');
  });

  it('executes browser-only conformance checks in Cypress', async () => {
    const report = await runConformance({
      label: 'cypress-browser',
      realBrowser: true,
      factory: indexedDB
    });
    const browserChecks = report.results.filter((result) => result.browserOnly);
    expect(browserChecks.every((result) => result.status !== 'skipped')).to.equal(true);

    const persistence = report.results.find((result) => result.name === 'reports real persistence state');
    expect(persistence?.status).to.equal('passed');

    const fallback = report.results.find((result) => result.name === 'opens the localStorage fallback when IndexedDB is missing');
    expect(fallback?.status).to.equal('passed');

    const reload = report.results.find((result) => result.name === 'survives a page reload with data intact');
    expect(reload?.status).to.equal('passed');
  });
});

describe('cana 100% coverage — table, transaction, and hooks', () => {
  it('classifies bulk puts with partial failures and compound-key gaps', async () => {
    const client = createClient({
      name: uniqueName('table-bulk'),
      schema: {
        version: 1,
        stores: [{ name: 'designs', keyPath: ['tenant', 'id'] }]
      }
    });
    const nested = createClient({
      name: uniqueName('table-nested-null'),
      schema: { version: 1, stores: [{ name: 'nested', keyPath: 'meta.id' }] }
    });
    try {
      await client.open();
      type Row = { tenant: string; id: number; name: string };
      const table = client.table<Row>('designs');
      await table.add({ tenant: 't1', id: 1, name: 'first' });

      const partial = await table.bulkAdd([
        { tenant: 't1', id: 1, name: 'dup' },
        { tenant: 't1', id: 2, name: 'ok' }
      ]).catch((error: unknown) => error);
      expect(isCanaErrorCode(partial, 'ConstraintViolation')).to.equal(true);

      // Missing compound part — covers extractKey's undefined-part arm.
      const compoundGap = await table.put({ tenant: 't1' } as never)
        .catch((error: unknown) => error);
      expect(isCanaError(compoundGap) || compoundGap instanceof DOMException
        || (compoundGap as { name?: string })?.name === 'DataError'
        || String(compoundGap).includes('key path')).to.equal(true);

      // Delete an existing row so record('deleted', key) omits the value arm.
      await table.add({ tenant: 't1', id: 2, name: 'second' });
      await table.delete(['t1', 2] as never);

      // Missing compound part on nested null meta.
      await nested.open();
      const missingPart = await nested.table<{ meta: null; tag: string }>('nested')
        .put({ meta: null, tag: 'x' })
        .catch((error: unknown) => error);
      expect(isCanaError(missingPart) || missingPart instanceof DOMException
        || (missingPart as { name?: string })?.name === 'DataError'
        || String(missingPart).includes('key path')).to.equal(true);
    } finally {
      await nested.close().catch(() => undefined);
      await client.close().catch(() => undefined);
    }
  });

  it('probes outbound autoIncrement puts without an explicit key', async () => {
    const client = createClient({
      name: uniqueName('table-outbound-probe'),
      schema: { version: 1, stores: [{ name: 'notes', autoIncrement: true }] }
    });
    try {
      await client.open();
      const table = client.table<{ title: string }>('notes');
      const created = await table.put({ title: 'generated-outbound' });
      expect(typeof created.key).to.equal('number');
    } finally {
      await client.close().catch(() => undefined);
    }
  });

  it('uses explicit keys and classifies outbound bulk puts as creates', async () => {
    const client = createClient({
      name: uniqueName('table-keys'),
      schema: { version: 1, stores: [{ name: 'notes', autoIncrement: true }] }
    });
    await client.open();
    const table = client.table<{ title: string }, string>('notes');
    const explicit = await table.add({ title: 'a' }, 'note-1');
    expect(explicit.key).to.equal('note-1');

    const { events } = await table.bulkPut([{ title: 'b' }, { title: 'c' }]);
    expect(events.map((event) => event.type)).to.deep.equal(['created', 'created']);
    await client.close();
  });

  it('translates requestToPromise rejections and persistence query-only paths', async () => {
    const request = {
      onsuccess: null as (() => void) | null,
      onerror: null as (() => void) | null,
      result: null as unknown,
      error: null as DOMException | null
    };
    setTimeout(() => {
      request.error = new DOMException('read failed', 'UnknownError');
      request.onerror?.();
    }, 0);

    expect(await rejection(requestToPromise(request as IDBRequest))).to.deep.include({ code: 'Internal' });

    const queryOnly = new StorageDurability({ persisted: async () => false });
    expect(await queryOnly.requestPersistence()).to.equal('unknown');

    // persist without persisted — skips the "already durable?" probe.
    const persistOnly = new StorageDurability({ persist: async () => true });
    expect(await persistOnly.requestPersistence()).to.equal(true);
  });

  it('notifies rollback hooks for unknown outcomes and unsubscribes cleanly', async () => {
    const seen: string[] = [];
    const transaction = {
      oncomplete: null as (() => void) | null,
      onabort: null as (() => void) | null,
      onerror: null as (() => void) | null,
      error: null,
      abort() { /* already committed */ },
      objectStore: () => ({ name: 'designs' })
    };
    const database = {
      objectStoreNames: { contains: () => true },
      transaction: () => {
        setTimeout(() => transaction.oncomplete?.(), 0);
        return transaction;
      },
      close: () => undefined
    } as unknown as IDBDatabase;
    const name = uniqueName('client-unknown-hook');
    const openRequest = {
      onsuccess: null as (() => void) | null,
      onerror: null as (() => void) | null,
      onupgradeneeded: null as (() => void) | null,
      onblocked: null as (() => void) | null,
      result: undefined as unknown,
      error: null as DOMException | null,
      transaction: null as unknown
    };
    const factory = {
      open: () => {
        setTimeout(() => {
          openRequest.result = database;
          openRequest.onsuccess?.();
        }, 0);
        return openRequest;
      },
      databases: async () => []
    } as unknown as IDBFactory;

    const client = createClient({
      name,
      schema: schema(),
      factory,
      hooks: { afterRollback: (outcome) => { seen.push(outcome); } }
    });
    await client.open();

    const result = await client.transaction('readwrite', ['designs'], async () => {
      throw new Error('application failure after commit');
    });
    expect(result.outcome).to.equal('unknown');
    expect(seen).to.deep.equal(['unknown']);

    const cursors: number[] = [];
    const stop = client.subscribe((event) => cursors.push(event.cursor));
    stop();
    // Second unsubscribe after removal — `indexOf` misses (`at < 0`).
    stop();
    await client.close();
  });

  it('includes key-less beforeWrite vetoes and IDB plain-Error rollbacks', async () => {
    const client = createClient({
      name: uniqueName('hook-noid'),
      schema: { version: 1, stores: [{ name: 'notes', autoIncrement: true }] },
      hooks: {
        beforeWrite: () => { throw new Error('veto-no-key'); }
      }
    });
    await client.open();
    try {
      const failure = await client.table<{ title: string }>('notes')
        .add({ title: 'x' })
        .catch((error: unknown) => error);
      expect(isCanaError(failure)).to.equal(true);
    } finally {
      await client.close();
    }

    const keyed = createClient({
      name: uniqueName('hook-with-key'),
      schema: schema(),
      hooks: {
        beforeWrite: (context) => {
          if (context.key !== undefined) throw new Error('veto-with-key');
        }
      }
    });
    await keyed.open();
    try {
      await keyed.table<{ id: number; name: string }>('designs').put({ id: 1, name: 'seed' });
      const veto = await keyed.table<{ id: number; name: string }>('designs')
        .update(1, { name: 'blocked' })
        .catch((error: unknown) => error);
      expect(isCanaError(veto)).to.equal(true);
      expect((veto as { message?: string }).message).to.include('veto-with-key');
    } finally {
      await keyed.close();
    }

    const seen: Array<string | undefined> = [];
    const idb = createClient({
      name: uniqueName('idb-plain-rollback'),
      schema: schema(),
      hooks: {
        afterRollback: (_outcome, reason) => { seen.push(reason); }
      }
    });
    await idb.open();
    try {
      await rejection(idb.transaction('readwrite', ['designs'], async (scope) => {
        await scope.table('designs').put({ id: 1, name: 'a' });
        throw new Error('plain-idb');
      }));
      // IDB path translates the body Error before notifyRolledBack, so the
      // reason is the message — unlike the localStorage catch which forwards
      // the raw throw.
      expect(seen).to.deep.equal(['plain-idb']);
    } finally {
      await idb.close();
    }
  });
});

describe('cana 100% coverage — worker host defensive paths', () => {
  it('serves writes with omitted optional payload fields', async () => {
    const client = createClient({ name: uniqueName('serve-write'), schema: schema() });
    await client.open();
    try {
      await serve(client, {
        kind: 'write', store: 'designs', requestId: 'b1', payload: { operation: 'bulkAdd' }
      });
      await serve(client, {
        kind: 'write', store: 'designs', requestId: 'b2', payload: { operation: 'bulkPut' }
      });
      await serve(client, {
        kind: 'write', store: 'designs', requestId: 'b3', payload: { operation: 'bulkDelete' }
      });
      // Seed so update's omitted `changes` (`?? {}`) path can run against a real row.
      await client.table<{ id: number; name: string }>('designs').put({ id: 1, name: 'seed' });
      await serve(client, {
        kind: 'write', store: 'designs', requestId: 'u1', key: 1, payload: { operation: 'update' }
      });
    } finally {
      await client.close();
    }
  });

  it('translates a plain Error through the host reply path', async () => {
    const channel = new MessageChannel();
    channel.port1.start();
    channel.port2.start();

    const host = createWorkerHost({
      name: uniqueName('host-plain'),
      schema: schema(),
      port: channel.port2 as unknown as Parameters<typeof createWorkerHost>[0]['port']
    });
    await host.client.open();
    const realTable = host.client.table.bind(host.client);
    host.client.table = ((name: string) => {
      const table = realTable(name);
      return {
        ...table,
        get: () => Promise.reject(new Error('plain table failure'))
      };
    }) as typeof host.client.table;

    const replies: CanaResponseEnvelope[] = [];
    channel.port1.addEventListener('message', (event) => {
      replies.push((event as MessageEvent).data as CanaResponseEnvelope);
    });
    channel.port1.postMessage({
      requestId: 'plain-1',
      kind: 'get',
      store: 'designs',
      key: 1
    });

    await new Promise((resolve) => { setTimeout(resolve, 30); });
    expect(replies).to.have.lengthOf(1);
    expect(replies[0]?.ok).to.equal(false);
    expect(replies[0]?.error).to.deep.include({ canaError: true, code: 'Internal' });

    await host.dispose();
    channel.port1.close();
    channel.port2.close();
  });

  it('can host without change broadcasts', async () => {
    const channel = new MessageChannel();
    channel.port1.start();
    channel.port2.start();
    const host = createWorkerHost({
      name: uniqueName('host-quiet'),
      schema: schema(),
      broadcastChanges: false,
      port: channel.port2 as unknown as Parameters<typeof createWorkerHost>[0]['port']
    });
    await host.client.open();
    await host.dispose();
    channel.port1.close();
    channel.port2.close();
  });
});
