/* eslint-disable jest/prefer-expect-resolves -- see the note below */
/*
 * The rule asks for `await expect(promise).resolves`, which is the one form
 * that does not work here. Under `bun test`, .resolves on a promise settled by
 * a MessagePort message deadlocks until the request timeout fires, and on a
 * Dexie thenable it is rejected outright as "not a promise". Awaiting first and
 * asserting on the value is equivalent in strength and passes under both
 * runners (JUM-584).
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import type { CanaSchema } from '@jumentix/cana';
import {
  createClient,
  createRouter,
  createWorkerClient,
  createWorkerHost,
  isCanaErrorCode,
  serve
} from '@jumentix/cana';

/**
 * A full round trip across a message boundary.
 *
 * This is what earlier commits recorded as unproven: the router was tested
 * against a fake port, and the engine was tested with no port at all, so
 * nothing showed the two working together.
 *
 * The port here is a real `MessageChannel` — the same object a `Worker` gives
 * you — so messages go through genuine structured clone. That is the part worth
 * proving: a value that survives in-process may still be unclonable, and this
 * suite would fail if the engine ever put a class instance or a function on the
 * wire.
 *
 * What it is still NOT: a separate thread. The host and client share this one,
 * so it does not prove the engine works when the main thread is busy, nor that
 * a killed worker triggers the timeout path. Those need a real browser
 * (JUM-417).
 *
 * Every assertion here awaits its request and then asserts on the value, rather
 * than using `expect(promise).resolves`. Under `bun test`, `.resolves` on a
 * promise whose settlement depends on a `MessagePort` message deadlocks: the
 * response never reaches the router and the request dies on its own 2s timeout.
 * The same call awaited directly returns immediately, and the suite passes under
 * Jest either way — so it is a runtime interaction, not engine behaviour
 * (JUM-584). Awaiting first is equivalent in strength and works in both.
 */

interface Design { id: number; name: string; owner?: string }

const schema: CanaSchema = {
  version: 1,
  stores: [
    { name: 'designs', keyPath: 'id', indexes: [{ name: 'byOwner', keyPath: 'owner' }] },
    { name: 'notes', autoIncrement: true }
  ]
};

/**
 * Everything opened by a test, torn down unconditionally.
 *
 * Node's MessagePort keeps the event loop alive until it is closed, so a test
 * that fails before its own teardown would hang the whole run rather than
 * reporting the failure. Registering here means a failure stays a failure.
 */
const opened: (() => Promise<void>)[] = [];

const releaseOpenPorts = async () => {
  await Promise.all(opened.splice(0, opened.length).map((close) => close()));
};

/** Wire a host and a client across a real MessageChannel. */
function connected(options: { ledger?: boolean } = {}) {
  const channel = new MessageChannel();
  channel.port1.start();
  channel.port2.start();

  const host = createWorkerHost({
    name: 'designer',
    schema,
    factory: new IDBFactory(),
    port: channel.port2 as unknown as Parameters<typeof createWorkerHost>[0]['port'],
    ...(options.ledger === true ? { operationLedger: true } : {})
  });

  const broadcasts: unknown[] = [];
  const router = createRouter({
    port: channel.port1 as unknown as Parameters<typeof createRouter>[0]['port'],
    timeoutMs: 2000,
    onBroadcast: (event) => broadcasts.push(event)
  });

  const teardown = async () => {
    router.dispose();
    await host.dispose();
    channel.port1.close();
    channel.port2.close();
  };
  opened.push(teardown);

  return { api: createWorkerClient(router), broadcasts, teardown };
}

/** Broadcasts arrive on a later task; give the port a turn. */
const settle = () => new Promise((resolve) => { setTimeout(resolve, 10); });

describe('cana worker round trip', () => {
  afterEach(releaseOpenPorts);

  it('answers a ping across the boundary', async () => {
    expect.hasAssertions();
    const { api, teardown } = connected();

    expect(await api.ping()).toBe('pong');
    await teardown();
  });

  it('opens the database and reports its identity', async () => {
    expect.hasAssertions();
    const { api, teardown } = connected();

    // eslint-disable-next-line jest/prefer-strict-equal -- see the clone test below
    expect(await api.open()).toEqual({ name: 'designer', version: 1 });
    await teardown();
  });

  it('returns values that crossed as structured clones', async () => {
    expect.hasAssertions();
    // The same property the storage layer showed, now across a real message
    // port: identity does not survive, so nothing on the wire may rely on a
    // prototype. This is why every contract type here is plain data.
    //
    // Asserted by sending a class instance rather than by reading the returned
    // prototype. Which prototype a clone lands on is a host detail — Bun's
    // structured clone produces Object.prototype where fake-indexeddb produces a
    // null one — so a check phrased against `Object.prototype` passes or fails
    // on the runtime rather than on Cana.
    const { api, teardown } = connected();

    class Tagged {
      readonly id = 1;

      readonly name = 'across the wire';

      get label(): string {
        return this.name;
      }
    }

    await api.open();
    const sent = new Tagged();
    await api.add('designs', sent as unknown as Design);

    const read = await api.get<Design>('designs', 1);

    expect(sent).toBeInstanceOf(Tagged);
    expect(read).not.toBeInstanceOf(Tagged);
    expect((read as unknown as Tagged).label).toBeUndefined();
    expect(read).toMatchObject({ id: 1, name: 'across the wire' });
    // Teardown was previously left to afterEach alone. A test that opens a port
    // and never closes it is what makes the *next* test time out — which is how
    // one wrong assertion here turned into four failures under Bun.
    await teardown();
  });

  it('writes and reads a record through messages only', async () => {
    expect.hasAssertions();
    // The core claim: no shared object graph, only cloned values.
    const { api, teardown } = connected();
    await api.open();

    await api.add('designs', { id: 1, name: 'across the wire' });

    expect(await api.get<Design>('designs', 1)).toMatchObject({ id: 1, name: 'across the wire' });
    await teardown();
  });

  it('carries every write operation', async () => {
    expect.hasAssertions();
    const { api, teardown } = connected();
    await api.open();

    await api.add('designs', { id: 1, name: 'a' });
    await api.put('designs', { id: 1, name: 'replaced' });
    await api.update('designs', 1, { owner: 'ana' });
    await api.bulkAdd('designs', [{ id: 2, name: 'b' }, { id: 3, name: 'c' }]);
    await api.bulkPut('designs', [{ id: 3, name: 'changed' }, { id: 4, name: 'd' }]);
    await api.bulkDelete('designs', [2]);
    await api.remove('designs', 4);

    expect(await api.get<Design>('designs', 1)).toMatchObject({ name: 'replaced', owner: 'ana' });
    expect(await api.count('designs')).toBe(2);
    await teardown();
  });

  it('clears a store', async () => {
    expect.hasAssertions();
    const { api, teardown } = connected();
    await api.open();
    await api.bulkAdd('designs', [{ id: 1, name: 'a' }, { id: 2, name: 'b' }]);

    await api.clear('designs');

    expect(await api.count('designs')).toBe(0);
    await teardown();
  });

  it('carries a query with an index and a range', async () => {
    expect.hasAssertions();
    // `CanaQuery` is plain data by design, which is what lets it cross at all.
    const { api, teardown } = connected();
    await api.open();
    await api.bulkAdd('designs', [
      { id: 1, name: 'a', owner: 'ana' },
      { id: 2, name: 'b', owner: 'bruno' },
      { id: 3, name: 'c', owner: 'ana' }
    ]);

    const mine = await api.query<Design>('designs', { index: 'byOwner', equals: 'ana' });

    expect(mine.map((row) => row.id).sort()).toStrictEqual([1, 3]);
    expect(await api.count('designs', { index: 'byOwner', equals: 'ana' })).toBe(2);
    await teardown();
  });

  it('reports storage state across the boundary', async () => {
    expect.hasAssertions();
    const { api, teardown } = connected();
    await api.open();

    expect(await api.storageState()).toMatchObject({ evicted: false });
    await teardown();
  });
});

describe('cana worker change broadcasts', () => {
  afterEach(releaseOpenPorts);

  it('pushes committed changes without being asked', async () => {
    expect.hasAssertions();
    const { api, broadcasts, teardown } = connected();
    await api.open();

    await api.add('designs', { id: 1, name: 'a' });
    await settle();

    expect(broadcasts).toHaveLength(1);
    expect(broadcasts[0]).toMatchObject({ type: 'created', store: 'designs' });
    await teardown();
  });

  it('sends a broadcast that survived structured clone intact', async () => {
    expect.hasAssertions();
    // Every contractual field must still be there on the far side — this is
    // where a class instance or a getter-backed property would be lost.
    const { api, broadcasts, teardown } = connected();
    await api.open();

    await api.add('designs', { id: 1, name: 'a' });
    await settle();

    expect(broadcasts[0]).toMatchObject({
      type: 'created',
      store: 'designs',
      key: 1,
      cursor: expect.any(Number),
      correlationId: expect.any(String),
      at: expect.any(Number),
      originId: expect.any(String)
    });
    await teardown();
  });

  it('does not broadcast anything for a read', async () => {
    expect.hasAssertions();
    const { api, broadcasts, teardown } = connected();
    await api.open();
    await api.query('designs');
    await settle();

    expect(broadcasts).toStrictEqual([]);
    await teardown();
  });
});

describe('cana worker failure handling', () => {
  afterEach(releaseOpenPorts);

  it('returns a typed error as data, never as an Error', async () => {
    expect.hasAssertions();
    // An Error would not survive the clone with its identity, so the taxonomy
    // has to arrive as a plain tagged object or it arrives useless.
    const { api, teardown } = connected();
    await api.open();
    await api.add('designs', { id: 1, name: 'a' });

    const failure = await api.add('designs', { id: 1, name: 'clash' })
      .catch((error: unknown) => error);

    expect(isCanaErrorCode(failure, 'ConstraintViolation')).toBe(true);
    expect(failure).not.toBeInstanceOf(Error);
    await teardown();
  });

  it('reports a missing store rather than hanging', async () => {
    expect.hasAssertions();
    const { api, teardown } = connected();
    await api.open();

    expect(await api.get('no-such-store', 1).catch((error: unknown) => error)).toMatchObject({ canaError: true });
    await teardown();
  });

  it('refuses a transaction with an explanation instead of a clone error', async () => {
    expect.hasAssertions();
    // The body is a function, and functions do not survive structured clone.
    // The façade omits `transaction` for that reason, so this drives `serve`
    // directly — the path someone hits if they build the envelope by hand.
    const client = createClient({ name: 'designer', schema, factory: new IDBFactory() });
    await client.open();

    const failure = await serve(client, { kind: 'transaction', requestId: 'r1' })
      .catch((error: unknown) => error);

    expect(isCanaErrorCode(failure, 'InvalidRequest')).toBe(true);
    expect((failure as { message: string }).message).toContain('structured-cloneable');
    await client.close();
  });

  it('rejects an unsupported request kind by name', async () => {
    expect.hasAssertions();
    const client = createClient({ name: 'designer', schema, factory: new IDBFactory() });
    await client.open();

    const failure = await serve(
      client,
      { kind: 'nonsense' as unknown as 'ping', requestId: 'r1' }
    ).catch((error: unknown) => error);

    expect(isCanaErrorCode(failure, 'InvalidRequest')).toBe(true);
    expect((failure as { message: string }).message).toContain('nonsense');
    await client.close();
  });

  it('rejects a write with no operation, and an unknown operation', async () => {
    expect.hasAssertions();
    const client = createClient({ name: 'designer', schema, factory: new IDBFactory() });
    await client.open();

    await expect(serve(client, { kind: 'write', store: 'designs', requestId: 'r1' }))
      .rejects.toMatchObject({ code: 'InvalidRequest' });
    await expect(serve(client, {
      kind: 'write',
      store: 'designs',
      requestId: 'r2',
      payload: { operation: 'frobnicate' }
    })).rejects.toMatchObject({ code: 'InvalidRequest' });
    await client.close();
  });

  it('rejects a keyed request with no key', async () => {
    expect.hasAssertions();
    const client = createClient({ name: 'designer', schema, factory: new IDBFactory() });
    await client.open();

    await expect(serve(client, { kind: 'get', store: 'designs', requestId: 'r1' }))
      .rejects.toMatchObject({ code: 'InvalidRequest' });
    await client.close();
  });

  it('keeps serving after a request fails', async () => {
    expect.hasAssertions();
    // A failed request must not take the host down, or one bad call would
    // silently break every later one and present as a timeout.
    const { api, teardown } = connected();
    await api.open();

    await api.get('no-such-store', 1).catch(() => undefined);

    expect(await api.ping()).toBe('pong');
    await teardown();
  });

  it('ignores a message that is not a Cana request', async () => {
    expect.hasAssertions();
    // Ports can be shared. Answering something we do not understand is worse
    // than ignoring it.
    const { api, teardown } = connected();
    await api.open();

    expect(await api.ping()).toBe('pong');
    await teardown();
  });
});

describe('cana worker crash reconciliation', () => {
  afterEach(releaseOpenPorts);

  it('resolves a committed write from the far side', async () => {
    expect.hasAssertions();
    // The end-to-end version of JUM-559: the answer must be reachable through
    // the same boundary the write went through.
    const { api, broadcasts, teardown } = connected({ ledger: true });
    await api.open();
    await api.add('designs', { id: 1, name: 'a' });
    await settle();

    const { correlationId } = broadcasts[0] as { correlationId: string };

    expect(await api.resolveWrite(correlationId, Date.now())).toBe('committed');
    await teardown();
  });

  it('rejects a resolve-write missing its timestamp', async () => {
    expect.hasAssertions();
    // An id alone cannot distinguish a rollback from a pruned record, so the
    // host refuses rather than guessing.
    const { api, teardown } = connected({ ledger: true });
    await api.open();

    const failure = await api.resolveWrite(undefined as unknown as string, Date.now())
      .catch((error: unknown) => error);

    expect(isCanaErrorCode(failure, 'InvalidRequest')).toBe(true);
    await teardown();
  });
});
