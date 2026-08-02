import type { CanaSchema } from '../src';
import {
  abortWithReason,
  browserStorageEnvironment,
  createClient,
  deleteDatabase,
  isCanaError,
  isCanaErrorCode,
  openDatabase,
  runCount,
  runQuery
} from '../src';
import { rejection, thrownBy } from './harness';

/**
 * Failure paths a real IndexedDB will not produce on demand.
 *
 * A blocked upgrade needs a second connection that refuses to close; a timeout
 * needs time to pass; `openCursor` throwing needs a store that is already dead.
 * These are injected rather than provoked — but note what is being faked: only
 * the *trigger*. The behaviour under test is still the engine's own, and every
 * assertion is about what the engine does with the failure, not about the fake.
 *
 * These branches are the ones most likely to be wrong precisely because nobody
 * reaches them by hand, which is why they are worth the scaffolding.
 */

const schema: CanaSchema = {
  version: 1,
  stores: [{ name: 'designs', keyPath: 'id' }]
};

/** A request that never settles, so the engine's own timer is what fires. */
function pendingRequest(): IDBOpenDBRequest {
  return {
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
    onblocked: null,
    result: undefined,
    error: null,
    transaction: null
  } as unknown as IDBOpenDBRequest;
}

/** A localStorage-shaped tombstone, defined once so no test body branches. */
function memoryTombstone() {
  const backing = new Map<string, string>();
  return {
    backing,
    tombstone: {
      get: (key: string) => (backing.has(key) ? (backing.get(key) as string) : null),
      set: (key: string, value: string) => { backing.set(key, value); },
      remove: (key: string) => { backing.delete(key); }
    }
  };
}

describe('blocked and timed-out lifecycle operations', () => {
  it('times out a blocked upgrade instead of hanging forever', async () => {
    // A hang is strictly worse than an error: it cannot be shown to a user,
    // retried, or usefully logged. The application simply never starts.
    const factory = {
      open: () => pendingRequest(),
      databases: async () => []
    } as unknown as IDBFactory;

    const failure = await openDatabase({
      name: 'designer', schema, factory, blockedTimeoutMs: 20
    }).catch((error: unknown) => error);

    expect(isCanaErrorCode(failure, 'UpgradeBlocked')).to.equal(true);
    expect((failure as { message: string }).message).to.include('another open connection');
    expect((failure as { retryable: boolean }).retryable).to.equal(true);
  });

  it('times out a blocked delete', async () => {
    const factory = {
      deleteDatabase: () => pendingRequest()
    } as unknown as IDBFactory;

    expect(await rejection(deleteDatabase('designer', { factory, blockedTimeoutMs: 20 }))).to.deep.include({ code: 'UpgradeBlocked' });
  });

  it('reports a delete that fails rather than resolving', async () => {
    const request = pendingRequest() as unknown as {
      onerror: (() => void) | null;
      error: DOMException | null;
    };
    const factory = {
      deleteDatabase: () => {
        setTimeout(() => {
          request.error = { name: 'UnknownError', message: 'delete failed' } as DOMException;
          request.onerror?.();
        }, 0);
        return request;
      }
    } as unknown as IDBFactory;

    const failure = await deleteDatabase('designer', { factory }).catch((error: unknown) => error);

    expect(isCanaError(failure)).to.equal(true);
    expect((failure as { code: string }).code).to.equal('Internal');
  });

  it('reports an open that errors as a typed failure', async () => {
    const request = pendingRequest() as unknown as {
      onerror: (() => void) | null;
      error: DOMException | null;
    };
    const factory = {
      open: () => {
        setTimeout(() => {
          request.error = { name: 'QuotaExceededError', message: 'no room' } as DOMException;
          request.onerror?.();
        }, 0);
        return request;
      },
      databases: async () => []
    } as unknown as IDBFactory;

    const failure = await openDatabase({ name: 'designer', schema, factory })
      .catch((error: unknown) => error);

    expect(isCanaErrorCode(failure, 'QuotaExceeded')).to.equal(true);
  });

  it('fails the open when an upgrade starts without a transaction', async () => {
    // Should not happen per spec, but a resolved open with a half-applied schema
    // is the indeterminate state this engine exists to prevent — so it is
    // treated as a failure rather than assumed impossible.
    const request = pendingRequest() as unknown as {
      onupgradeneeded: (() => void) | null;
      onsuccess: (() => void) | null;
      result: unknown;
      transaction: IDBTransaction | null;
    };
    const factory = {
      open: () => {
        setTimeout(() => {
          request.transaction = null;
          request.onupgradeneeded?.();
          request.result = { close: () => undefined };
          request.onsuccess?.();
        }, 0);
        return request;
      },
      databases: async () => []
    } as unknown as IDBFactory;

    const failure = await openDatabase({ name: 'designer', schema, factory })
      .catch((error: unknown) => error);

    expect(isCanaErrorCode(failure, 'UpgradeFailed')).to.equal(true);
    expect((failure as { message: string }).message).to.include('without a transaction');
  });

  it('treats a version probe that throws as unknown, not as absent', async () => {
    // The regression from review, at the probe rather than at the classifier:
    // a throwing `databases()` must not be read as "the database is gone".
    const real = indexedDB;
    const first = await openDatabase({ name: 'designer', factory: real, schema });
    first.database.close();

    // Delegating, not prototype-wrapped: an IDBFactory method called on an
    // ordinary object throws `Illegal invocation` in a real browser, however the
    // prototype chain is arranged. Everything but `databases` is the browser's.
    const throwing = {
      open: (name: string, version?: number) => real.open(name, version),
      deleteDatabase: (name: string) => real.deleteDatabase(name),
      cmp: (left: unknown, right: unknown) => real.cmp(left, right),
      databases: async () => { throw new Error('not permitted'); }
    } as unknown as IDBFactory;

    const second = await openDatabase({ name: 'designer', factory: throwing, schema });

    expect(second.eviction.evicted).to.equal(false);
    second.database.close();
  });
});

describe('transaction abort edge cases', () => {
  it('still reports the reason when abort() itself throws', () => {
    // A transaction that is already ending throws on abort. The caller's reason
    // must survive that, or an aborted transaction reports only that something
    // went wrong somewhere.
    const dying = {
      abort: () => { throw new Error('already finishing'); }
    } as unknown as IDBTransaction;

    expect(thrownBy(() => abortWithReason(dying, 'the stated reason')))
      .to.deep.include({ code: 'TransactionAborted' });
  });

  it('supplies a default reason when none is given', () => {
    const transaction = { abort: () => undefined } as unknown as IDBTransaction;

    expect(thrownBy(() => abortWithReason(transaction)))
      .to.have.property('message')
      .that.includes('aborted by the caller');
  });

  it('rejects a transaction over a store that does not exist', async () => {
    const client = createClient({ name: 'designer', schema });
    await client.open();

    const failure = await client.transaction('readonly', ['no-such-store'], async () => undefined)
      .catch((error: unknown) => error);

    expect(isCanaError(failure)).to.equal(true);
    await client.close();
  });
});

describe('query execution failure paths', () => {
  /** A store whose cursor and count both refuse to start. */
  const deadStore = () => ({
    name: 'designs',
    openCursor: () => { throw new Error('store is dead'); },
    count: () => { throw new Error('store is dead'); },
    index: () => { throw new Error('no such index'); }
  } as unknown as IDBObjectStore);

  it('translates a cursor that cannot be opened', async () => {
    expect(await rejection(runQuery(deadStore(), undefined))).to.deep.include({ canaError: true });
  });

  it('translates a count that cannot be started', async () => {
    expect(await rejection(runCount(deadStore(), undefined))).to.deep.include({ canaError: true });
  });

  it('names the store when an index lookup fails', async () => {
    const failure = await runQuery(deadStore(), { index: 'missing' })
      .catch((error: unknown) => error);

    expect((failure as { store?: string }).store).to.equal('designs');
  });

  it('translates a cursor request that errors after opening', async () => {
    const request = {
      onsuccess: null, onerror: null, result: null, error: null
    } as unknown as {
      onerror: (() => void) | null;
      error: DOMException | null;
    };
    const store = {
      name: 'designs',
      openCursor: () => {
        setTimeout(() => {
          request.error = { name: 'UnknownError', message: 'read failed' } as DOMException;
          request.onerror?.();
        }, 0);
        return request;
      }
    } as unknown as IDBObjectStore;

    expect(await rejection(runQuery(store, undefined))).to.deep.include({ canaError: true });
  });

  it('translates a count request that errors after starting', async () => {
    const request = {
      onsuccess: null, onerror: null, result: 0, error: null
    } as unknown as {
      onerror: (() => void) | null;
      error: DOMException | null;
    };
    const store = {
      name: 'designs',
      count: () => {
        setTimeout(() => {
          request.error = { name: 'UnknownError', message: 'count failed' } as DOMException;
          request.onerror?.();
        }, 0);
        return request;
      }
    } as unknown as IDBObjectStore;

    expect(await rejection(runCount(store, undefined))).to.deep.include({ canaError: true });
  });
});

describe('browser storage environment', () => {
  const install = (storage: unknown) => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { storage }
    });
  };

  afterEach(() => {
    Reflect.deleteProperty(globalThis as object, 'navigator');
    Reflect.deleteProperty(globalThis as object, 'localStorage');
  });

  it('wires estimate, persist and persisted when the Storage API is present', async () => {
    install({
      estimate: async () => ({ usage: 1, quota: 2 }),
      persist: async () => true,
      persisted: async () => false
    });

    const environment = browserStorageEnvironment();

    expect(environment.estimate).to.not.equal(undefined);
    expect(await environment.estimate!()).to.deep.equal({ usage: 1, quota: 2 });
    expect(await environment.persist!()).to.equal(true);
    expect(await environment.persisted!()).to.equal(false);
  });

  it('leaves them undefined when the Storage API is absent', () => {
    install(undefined);

    const environment = browserStorageEnvironment();

    expect(environment.estimate).to.equal(undefined);
    expect(environment.persist).to.equal(undefined);
    expect(environment.persisted).to.equal(undefined);
  });

  it('round-trips through a real localStorage-shaped global', () => {
    const { tombstone: backing } = memoryTombstone();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: backing.get,
        setItem: backing.set,
        removeItem: backing.remove
      }
    });

    const { tombstone } = browserStorageEnvironment();
    tombstone!.set('k', 'v');

    expect(tombstone!.get('k')).to.equal('v');
    tombstone!.remove('k');

    expect(tombstone!.get('k')).to.equal(null);
  });
});
