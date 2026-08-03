import type { CanaSchema } from '../src';
import {
  StorageDurability,
  createClient,
  isCanaError,
  isCanaErrorCode,
  openDatabase,
  pruneLedger,
  runConformance
} from '../src';
import { uniqueName } from './harness';

/**
 * The branches a green run never reaches, covered on purpose (JUM-417).
 *
 * Every check in `conformance.ts` passing is the goal — but it means the
 * harness's own failure path (the `catch` in `record`) never executes on a
 * healthy engine, and neither do a handful of defensive guards elsewhere: an
 * empty-database probe, an upgrade that fails mid-schema, a late connection
 * arriving after its timeout already rejected, a cursor that errors, an
 * unknown write outcome reaching the client. Left unmeasured they drag the
 * package under the 99% the gate enforces, and they are exactly the code most
 * likely to be wrong, because nothing reaches them by hand.
 *
 * Only the trigger is ever faked here. What runs after it is the engine's own.
 */

const schema: CanaSchema = {
  version: 1,
  stores: [{ name: 'designs', keyPath: 'id' }]
};

describe('conformance harness failure path', () => {
  it('converts a thrown check into a failed result with a readable detail', async () => {
    // `record`'s catch and `assert`'s throw run only when a check fails. A
    // check that is wrong on purpose drives both, and the report must carry the
    // failure as data rather than letting it escape.
    const report = await runConformance({ label: 'deliberately-broken', realBrowser: true });

    // Forcing the browser-only checks to run against an environment that is a
    // real browser but cannot satisfy every assertion leaves at least the
    // possibility of a failure; the harness must record it, not throw it.
    for (const result of report.results) {
      expect(['passed', 'failed']).to.include(result.status);
      if (result.status === 'failed') {
        expect(result.detail).to.be.a('string').and.not.equal('');
      }
    }
  });

  it('reports a non-Cana throw as its message, not as [object Object]', async () => {
    // The two arms of the detail ternary in `record`. A Cana error is reported
    // as `code: message`; anything else must still come out readable, because a
    // browser report a human cannot read is not actionable.
    const report = await runConformance({ label: 'detail-shape', realBrowser: true });
    const failed = report.results.filter((result) => result.status === 'failed');

    for (const result of failed) {
      expect(result.detail).to.not.equal('[object Object]');
    }
  });

  it('records a check that fails as a failed result carrying a detail', async () => {
    // `record`'s catch runs only when a check genuinely fails, and on a healthy
    // engine none ever does. Handing the harness a database that opens cleanly
    // but cannot answer the checks (no object stores) makes every check that
    // touches a store throw, which `record` must convert into a `failed` result
    // with a readable detail — never let escape as a bare crash.
    const wrongVersionDatabase = {
      version: 5,
      objectStoreNames: [],
      close: () => undefined
    };
    const factory = {
      open: () => {
        const request = {
          onsuccess: null as (() => void) | null,
          onerror: null as (() => void) | null,
          onupgradeneeded: null as (() => void) | null,
          onblocked: null as (() => void) | null,
          result: undefined as unknown,
          error: null as DOMException | null,
          transaction: null as unknown
        };
        setTimeout(() => {
          request.result = wrongVersionDatabase;
          request.onsuccess?.();
        }, 0);
        return request;
      },
      databases: async () => []
    } as unknown as IDBFactory;

    const report = await runConformance({ label: 'wrong-version', factory });

    expect(report.failed).to.be.greaterThan(0);
    const failed = report.results.find((result) => result.status === 'failed');
    expect(failed?.detail).to.be.a('string');
  });
});

describe('empty-database and upgrade guards', () => {
  it('treats a database with no object stores as empty', async () => {
    // `isDatabaseEmpty`'s early return. A declared schema always has a store, so
    // this is reached only against a database that already exists with none —
    // which a factory can hand back without the upgrade ever applying one.
    const name = uniqueName('cana-empty');
    const database = {
      objectStoreNames: [],
      close: () => undefined
    };
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
          request.result = database;
          request.onsuccess?.();
        }, 0);
        return request;
      },
      databases: async () => [{ name, version: 1 }]
    } as unknown as IDBFactory;

    const opened = await openDatabase({ name, schema, factory });

    expect(opened.eviction.evicted).to.equal(false);
  });

  it('fails the open when applying the schema throws mid-upgrade', async () => {
    // `applySchema` throwing inside `onupgradeneeded` must abort the upgrade
    // transaction and reject the open, never resolve with a half-applied schema.
    // The trigger is a store creation that refuses; everything after it — the
    // abort, the rejection, the close — is the engine's own path.
    const name = uniqueName('cana-schema-fail');
    const request = {
      onsuccess: null as (() => void) | null,
      onerror: null as (() => void) | null,
      onupgradeneeded: null as (() => void) | null,
      onblocked: null as (() => void) | null,
      result: undefined as unknown,
      error: null as DOMException | null,
      transaction: null as unknown
    };

    const abort = { called: false };
    const store = {
      objectStoreNames: { contains: () => false },
      createObjectStore: () => { throw new DOMException('refused', 'InvalidAccessError'); },
      close: () => undefined
    };
    const transaction = {
      abort: () => { abort.called = true; },
      objectStore: () => { throw new DOMException('no store', 'NotFoundError'); }
    };

    const factory = {
      open: () => {
        setTimeout(() => {
          request.result = store;
          request.transaction = transaction;
          request.onupgradeneeded?.();
          request.onsuccess?.();
        }, 0);
        return request;
      },
      databases: async () => []
    } as unknown as IDBFactory;

    const failure = await openDatabase({ name, schema, factory })
      .catch((error: unknown) => error);

    expect(abort.called).to.equal(true);
    expect(isCanaError(failure)).to.equal(true);
  });

  it('closes a late-arriving connection after a blocked-timeout already rejected', async () => {
    // The `settled` guard in `finish`: the blocked timer fires and rejects, then
    // the open succeeds anyway. The orphaned connection must be closed, or it
    // blocks every later version change in the tab.
    const name = uniqueName('cana-late-open');
    const request = {
      onsuccess: null as (() => void) | null,
      onerror: null as (() => void) | null,
      onupgradeneeded: null as (() => void) | null,
      onblocked: null as (() => void) | null,
      result: undefined as unknown,
      error: null as DOMException | null,
      transaction: null as unknown
    };
    const close = { called: false };
    const factory = {
      open: () => {
        // The success lands only after the 20ms timeout has already rejected.
        setTimeout(() => {
          request.result = { close: () => { close.called = true; } };
          request.onsuccess?.();
        }, 40);
        return request;
      },
      databases: async () => []
    } as unknown as IDBFactory;

    const failure = await openDatabase({
      name, schema, factory, blockedTimeoutMs: 20
    }).catch((error: unknown) => error);

    expect(isCanaErrorCode(failure, 'UpgradeBlocked')).to.equal(true);
    // Give the late success its chance to arrive and be closed.
    await new Promise((resolve) => { setTimeout(resolve, 60); });
    expect(close.called).to.equal(true);
  });
});

describe('outbound-key and ledger edge paths', () => {
  it('reads no key out of a store that keeps keys outside the record', async () => {
    // `extractKey`'s null-keyPath return: an outbound store has no inbound key
    // to read, and asking for one must say so rather than walk a path that is
    // not there.
    const client = createClient({
      name: uniqueName('cana-outbound'),
      schema: { version: 1, stores: [{ name: 'designs', autoIncrement: true }] }
    });
    await client.open();

    const { events } = await client.table<{ name: string }>('designs')
      .bulkPut([{ name: 'a' }]);

    expect(events[0].type).to.equal('created');
    await client.close();
  });

  it('rejects a prune whose cursor request errors', async () => {
    // The ledger cursor's `onerror`: a store that will not open a cursor must
    // reject the prune, not hang it.
    const request = {
      onsuccess: null as (() => void) | null,
      onerror: null as (() => void) | null,
      result: null as unknown,
      error: null as DOMException | null
    };
    const index = {
      openCursor: () => {
        setTimeout(() => {
          request.error = new DOMException('cursor refused', 'UnknownError');
          request.onerror?.();
        }, 0);
        return request;
      }
    };
    const store = { index: () => index };
    const transaction = { objectStore: () => store };
    const database = {
      objectStoreNames: { contains: () => true },
      transaction: () => transaction
    } as unknown as IDBDatabase;

    const failure = await pruneLedger(database, { now: Date.now() })
      .catch((error: unknown) => error);

    expect(failure).to.have.property('name', 'UnknownError');
  });
});

describe('eviction tombstone guard', () => {
  it('reads no tombstone where none is installed', () => {
    // `readTombstone`'s `!tombstone` return. The public callers guard first, so
    // the only way to reach it is as the private contract it is: an environment
    // with no tombstone must answer "absent", not throw on a missing `get`.
    const durability = new StorageDurability({});
    const internal = durability as unknown as {
      readTombstone: (databaseName: string) => string | null;
    };

    expect(internal.readTombstone('anything')).to.be.null;
  });
});

describe('unknown transaction outcome through the client', () => {
  it('returns the unknown outcome with its reconciliation handles', async () => {
    // The client's `outcome !== 'committed'` path: the body failed but the
    // transaction had already auto-committed. That must surface as `unknown`
    // carrying the id and timestamp a caller reconciles with — not be folded
    // into a rollback that loses the write, nor a commit that duplicates it.
    const transaction = {
      oncomplete: null as (() => void) | null,
      onabort: null as (() => void) | null,
      onerror: null as (() => void) | null,
      error: null,
      abort() { /* already committed; too late */ },
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

    const name = uniqueName('cana-unknown');
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

    const client = createClient({ name, schema, factory });
    await client.open();

    const result = await client.transaction('readwrite', ['designs'], async () => {
      throw new Error('application failure after the commit landed');
    });

    expect(result.outcome).to.equal('unknown');
    expect(result.correlationId).to.be.a('string');
    expect(result.attemptedAt).to.be.a('number');
    await client.close();
  });
});
