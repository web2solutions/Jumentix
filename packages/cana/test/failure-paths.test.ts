import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import type { CanaSchema } from '@jumentix/cana';
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
} from '@jumentix/cana';

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
    expect.hasAssertions();
    // A hang is strictly worse than an error: it cannot be shown to a user,
    // retried, or usefully logged. The application simply never starts.
    const factory = {
      open: () => pendingRequest(),
      databases: async () => []
    } as unknown as IDBFactory;

    const failure = await openDatabase({
      name: 'designer', schema, factory, blockedTimeoutMs: 20
    }).catch((error: unknown) => error);

    expect(isCanaErrorCode(failure, 'UpgradeBlocked')).toBe(true);
    expect((failure as { message: string }).message).toContain('another open connection');
    expect((failure as { retryable: boolean }).retryable).toBe(true);
  });

  it('times out a blocked delete', async () => {
    expect.hasAssertions();
    const factory = {
      deleteDatabase: () => pendingRequest()
    } as unknown as IDBFactory;

    await expect(deleteDatabase('designer', { factory, blockedTimeoutMs: 20 }))
      .rejects.toMatchObject({ code: 'UpgradeBlocked' });
  });

  it('reports a delete that fails rather than resolving', async () => {
    expect.hasAssertions();
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

    expect(isCanaError(failure)).toBe(true);
    expect((failure as { code: string }).code).toBe('Internal');
  });

  it('reports an open that errors as a typed failure', async () => {
    expect.hasAssertions();
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

    expect(isCanaErrorCode(failure, 'QuotaExceeded')).toBe(true);
  });

  it('fails the open when an upgrade starts without a transaction', async () => {
    expect.hasAssertions();
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

    expect(isCanaErrorCode(failure, 'UpgradeFailed')).toBe(true);
    expect((failure as { message: string }).message).toContain('without a transaction');
  });

  it('treats a version probe that throws as unknown, not as absent', async () => {
    expect.hasAssertions();
    // The regression from review, at the probe rather than at the classifier:
    // a throwing `databases()` must not be read as "the database is gone".
    const real = new IDBFactory();
    const first = await openDatabase({ name: 'designer', factory: real, schema });
    first.database.close();

    const throwing = Object.create(real) as IDBFactory;
    Object.defineProperty(throwing, 'databases', {
      value: async () => { throw new Error('not permitted'); }
    });

    const second = await openDatabase({ name: 'designer', factory: throwing, schema });

    expect(second.eviction.evicted).toBe(false);
    second.database.close();
  });
});

describe('transaction abort edge cases', () => {
  it('still reports the reason when abort() itself throws', () => {
    expect.hasAssertions();
    // A transaction that is already ending throws on abort. The caller's reason
    // must survive that, or an aborted transaction reports only that something
    // went wrong somewhere.
    const dying = {
      abort: () => { throw new Error('already finishing'); }
    } as unknown as IDBTransaction;

    expect(() => abortWithReason(dying, 'the stated reason'))
      .toThrow(expect.objectContaining({ code: 'TransactionAborted' }));
  });

  it('supplies a default reason when none is given', () => {
    expect.hasAssertions();
    const transaction = { abort: () => undefined } as unknown as IDBTransaction;

    expect(() => abortWithReason(transaction)).toThrow(
      expect.objectContaining({ message: expect.stringContaining('aborted by the caller') })
    );
  });

  it('rejects a transaction over a store that does not exist', async () => {
    expect.hasAssertions();
    const client = createClient({ name: 'designer', schema, factory: new IDBFactory() });
    await client.open();

    const failure = await client.transaction('readonly', ['no-such-store'], async () => undefined)
      .catch((error: unknown) => error);

    expect(isCanaError(failure)).toBe(true);
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
    expect.hasAssertions();
    await expect(runQuery(deadStore(), undefined)).rejects.toMatchObject({ canaError: true });
  });

  it('translates a count that cannot be started', async () => {
    expect.hasAssertions();
    await expect(runCount(deadStore(), undefined)).rejects.toMatchObject({ canaError: true });
  });

  it('names the store when an index lookup fails', async () => {
    expect.hasAssertions();
    const failure = await runQuery(deadStore(), { index: 'missing' })
      .catch((error: unknown) => error);

    expect((failure as { store?: string }).store).toBe('designs');
  });

  it('translates a cursor request that errors after opening', async () => {
    expect.hasAssertions();
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

    await expect(runQuery(store, undefined)).rejects.toMatchObject({ canaError: true });
  });

  it('translates a count request that errors after starting', async () => {
    expect.hasAssertions();
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

    await expect(runCount(store, undefined)).rejects.toMatchObject({ canaError: true });
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
    expect.hasAssertions();
    install({
      estimate: async () => ({ usage: 1, quota: 2 }),
      persist: async () => true,
      persisted: async () => false
    });

    const environment = browserStorageEnvironment();

    expect(environment.estimate).toBeDefined();
    await expect(environment.estimate!()).resolves.toStrictEqual({ usage: 1, quota: 2 });
    await expect(environment.persist!()).resolves.toBe(true);
    await expect(environment.persisted!()).resolves.toBe(false);
  });

  it('leaves them undefined when the Storage API is absent', () => {
    expect.hasAssertions();
    install(undefined);

    const environment = browserStorageEnvironment();

    expect(environment.estimate).toBeUndefined();
    expect(environment.persist).toBeUndefined();
    expect(environment.persisted).toBeUndefined();
  });

  it('round-trips through a real localStorage-shaped global', () => {
    expect.hasAssertions();
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

    expect(tombstone!.get('k')).toBe('v');
    tombstone!.remove('k');

    expect(tombstone!.get('k')).toBeNull();
  });
});
