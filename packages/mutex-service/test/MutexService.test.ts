import { MutexService } from '../src/MutexService';
import type { IKeyValueStorageClient, IServiceResponse } from '../src/contracts';

/**
 * Requirement 112 — this package owns its suite.
 *
 * A distributed lock is the wrong thing to test through a consumer. The
 * application exercises the happy path — take a lock, release it — and the
 * paths that matter are the other ones: the storage saying no, the storage
 * throwing, the second caller finding the resource already held. Those decide
 * whether two writers can run at once, and none of them appear in a passing
 * application test.
 */

/** A storage client whose three operations are set per test. */
function storage(over: Partial<IKeyValueStorageClient> = {}): IKeyValueStorageClient {
  return {
    get: async () => ({ result: undefined }),
    set: async () => ({ result: 'OK' }),
    del: async () => ({ result: 1 }),
    connect: async () => ({ result: true }),
    disconnect: async () => ({ result: true }),
    ...over
  };
}

/*
 * Resets before compiling, not after each test.
 *
 * `compile` is a singleton, so a service built without clearing it first returns
 * the previous one and the previous client — and the failure surfaces in
 * whichever test ran next, not in the one that caused it. Resetting on the way
 * in makes each test independent of what ran before it, which an `afterEach`
 * cannot promise if a test throws before its own cleanup.
 */
const build = (client = storage()) => {
  MutexService.reset();
  return MutexService.compile(client);
};

describe('lock', () => {
  it('takes the lock when the resource is free', async () => {
    expect.hasAssertions();

    const service = build(storage({ get: async () => ({ result: undefined }) }));

    await expect(service.lock('orders', 'uuid-1')).resolves.toMatchObject({
      result: { previouslyLocked: false, locked: true }
    });
  });

  /**
   * The contended case, and the reason the whole class exists. It must report
   * `locked: false` — the caller did *not* acquire it — while also saying the
   * resource was already held, so the caller can tell "someone else has it"
   * from "the store refused me".
   */
  it('refuses and reports when the resource is already held', async () => {
    expect.hasAssertions();

    const writes: string[] = [];
    const service = build(storage({
      get: async () => ({ result: 'locked' }),
      set: async (key: string) => {
        writes.push(key);
        return { result: 'OK' };
      }
    }));

    await expect(service.lock('orders', 'uuid-1')).resolves.toMatchObject({
      result: { previouslyLocked: true, locked: false }
    });
    // And it must not overwrite the holder's key on the way past.
    expect(writes).toStrictEqual([]);
  });

  /**
   * A store that answers without writing is not a lock. `locked` follows the
   * store's own result, so a `set` that returns nothing reports failure rather
   * than assuming success.
   */
  it('reports not-locked when the store writes nothing', async () => {
    expect.hasAssertions();

    const service = build(storage({ set: async () => ({ result: undefined }) }));

    await expect(service.lock('orders', 'uuid-1')).resolves.toMatchObject({
      result: { previouslyLocked: false, locked: false }
    });
  });

  it.each([
    ['the store returns an error', { set: async () => ({ error: new Error('store said no') }) }],
    ['the store throws', { set: async () => { throw new Error('store said no'); } }]
  ])('surfaces the failure as an error response when %s', async (_label, over) => {
    expect.hasAssertions();

    const service = build(storage(over as Partial<IKeyValueStorageClient>));
    const response = await service.lock('orders', 'uuid-1') as IServiceResponse;

    expect(response.error).toBeDefined();
    expect(response.result).toBeUndefined();
  });
});

describe('isLocked', () => {
  it.each([
    ['a stored value', 'locked', true],
    ['no stored value', undefined, false],
    ['an empty string', '', false]
  ])('reports %s as %s', async (_label, stored, expected) => {
    expect.hasAssertions();

    const service = build(storage({ get: async () => ({ result: stored }) }));

    await expect(service.isLocked('orders', 'uuid-1')).resolves.toMatchObject({
      result: expected
    });
  });

  it('surfaces a store failure rather than reporting unlocked', async () => {
    expect.hasAssertions();

    // The dangerous default. A store error read as "not locked" hands the lock
    // to a second writer.
    const service = build(storage({ get: async () => ({ error: new Error('down') }) }));
    const response = await service.isLocked('orders', 'uuid-1') as IServiceResponse;

    expect(response.error).toBeDefined();
    expect(response.result).toBeUndefined();
  });
});

describe('unlock', () => {
  it('deletes the key and returns what the store reported', async () => {
    expect.hasAssertions();

    const deleted: string[] = [];
    const service = build(storage({
      del: async (key: string) => {
        deleted.push(key);
        return { result: 1 };
      }
    }));

    await expect(service.unlock('orders', 'uuid-1')).resolves.toMatchObject({ result: 1 });
    expect(deleted).toHaveLength(1);
  });

  it('surfaces a delete failure', async () => {
    expect.hasAssertions();

    const service = build(storage({ del: async () => ({ error: new Error('down') }) }));

    expect(((await service.unlock('orders', 'uuid-1')) as IServiceResponse).error).toBeDefined();
  });
});

describe('key layout', () => {
  /**
   * The key is `mutex::<resource>:<uuid>` — two colons, because the prefix
   * already ends in one and the template adds another. It reads like a typo and
   * is load-bearing: changing it orphans every lock currently held under the old
   * shape, and the holders would never see them released.
   */
  it('addresses the same key across lock, isLocked and unlock', async () => {
    expect.hasAssertions();

    const keys: string[] = [];
    const record = async (key: string) => {
      keys.push(key);
      return { result: undefined };
    };

    const service = build(storage({ get: record, set: record, del: record }));

    await service.lock('orders', 'uuid-1');
    await service.unlock('orders', 'uuid-1');

    expect([...new Set(keys)]).toStrictEqual(['mutex::orders:uuid-1']);
  });

  it('honours a configured prefix', async () => {
    expect.hasAssertions();

    const keys: string[] = [];
    MutexService.reset();
    const service = MutexService.compile(
      storage({
        get: async (key: string) => {
          keys.push(key);
          return { result: undefined };
        }
      }),
      { prefix: 'tenant-a' }
    );

    await service.isLocked('orders', 'uuid-1');

    expect(keys).toStrictEqual(['tenant-a::orders:uuid-1']);
  });
});

describe('compile', () => {
  it('returns the same instance on a second call', () => {
    expect.hasAssertions();

    MutexService.reset();
    const first = MutexService.compile(storage());

    expect(MutexService.compile(storage())).toBe(first);
  });

  /**
   * The singleton ignores the client given to a later call. Asserted because it
   * is surprising: a caller reconfiguring the storage would get the old one and
   * no indication of it.
   */
  it('keeps the first client even when a different one is offered', async () => {
    expect.hasAssertions();

    const used: string[] = [];
    MutexService.reset();
    MutexService.compile(storage({
      get: async () => {
        used.push('first');
        return { result: undefined };
      }
    }));

    const second = MutexService.compile(storage({
      get: async () => {
        used.push('second');
        return { result: undefined };
      }
    }));

    await second.isLocked('orders', 'uuid-1');

    expect(used).toStrictEqual(['first']);
  });

  it('builds a fresh instance after reset', () => {
    expect.hasAssertions();

    MutexService.reset();
    const first = MutexService.compile(storage());
    MutexService.reset();

    expect(MutexService.compile(storage())).not.toBe(first);
  });

  it('refuses to compile without a storage client', () => {
    expect.hasAssertions();

    MutexService.reset();

    expect(() => MutexService.compile(undefined as unknown as IKeyValueStorageClient))
      .toThrow('MutexService depends on KeyValueStorageClient implementation');
  });
});
