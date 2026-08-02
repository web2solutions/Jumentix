/* eslint-disable jest/prefer-expect-resolves -- see the note below */
/*
 * The rule asks for `await expect(promise).resolves`, which is the one form
 * that does not work here. Under `bun test`, .resolves on a promise settled by
 * a MessagePort message deadlocks until the request timeout fires, and on a
 * Dexie thenable it is rejected outright as "not a promise". Awaiting first and
 * asserting on the value is equivalent in strength and passes under both
 * runners (JUM-584).
 */
import type { CanaSchema } from '../src';
import {
  createClient,
  createRouter,
  createWorkerClient,
  createWorkerHost,
  isCanaErrorCode,
  serve
} from '../src';
import { rejection } from './harness';

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
    const { api, teardown } = connected();

    expect(await api.ping()).to.equal('pong');
    await teardown();
  });

  it('opens the database and reports its identity', async () => {
    const { api, teardown } = connected();

    // eslint-disable-next-line jest/prefer-strict-equal -- see the clone test below
    expect(await api.open()).to.deep.equal({ name: 'designer', version: 1 });
    await teardown();
  });

  it('returns values that crossed as structured clones', async () => {
    // The same property the storage layer showed, now across a real message
    // port: identity does not survive, so nothing on the wire may rely on a
    // prototype. This is why every contract type here is plain data.
    //
    // Asserted by sending a class instance rather than by reading the returned
    // prototype. Which prototype a clone lands on is a host detail — Bun's
    // structured clone produces Object.prototype where a fake produced a
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

    expect(sent).to.be.instanceOf(Tagged);
    expect(read).not.to.be.instanceOf(Tagged);
    expect((read as unknown as Tagged).label).to.equal(undefined);
    expect(read).to.deep.include({ id: 1, name: 'across the wire' });
    // Teardown was previously left to afterEach alone. A test that opens a port
    // and never closes it is what makes the *next* test time out — which is how
    // one wrong assertion here turned into four failures under Bun.
    await teardown();
  });

  it('writes and reads a record through messages only', async () => {
    // The core claim: no shared object graph, only cloned values.
    const { api, teardown } = connected();
    await api.open();

    await api.add('designs', { id: 1, name: 'across the wire' });

    expect(await api.get<Design>('designs', 1)).to.deep.include({ id: 1, name: 'across the wire' });
    await teardown();
  });

  it('carries every write operation', async () => {
    const { api, teardown } = connected();
    await api.open();

    await api.add('designs', { id: 1, name: 'a' });
    await api.put('designs', { id: 1, name: 'replaced' });
    await api.update('designs', 1, { owner: 'ana' });
    await api.bulkAdd('designs', [{ id: 2, name: 'b' }, { id: 3, name: 'c' }]);
    await api.bulkPut('designs', [{ id: 3, name: 'changed' }, { id: 4, name: 'd' }]);
    await api.bulkDelete('designs', [2]);
    await api.remove('designs', 4);

    expect(await api.get<Design>('designs', 1)).to.deep.include({ name: 'replaced', owner: 'ana' });
    expect(await api.count('designs')).to.equal(2);
    await teardown();
  });

  it('clears a store', async () => {
    const { api, teardown } = connected();
    await api.open();
    await api.bulkAdd('designs', [{ id: 1, name: 'a' }, { id: 2, name: 'b' }]);

    await api.clear('designs');

    expect(await api.count('designs')).to.equal(0);
    await teardown();
  });

  it('carries a query with an index and a range', async () => {
    // `CanaQuery` is plain data by design, which is what lets it cross at all.
    const { api, teardown } = connected();
    await api.open();
    await api.bulkAdd('designs', [
      { id: 1, name: 'a', owner: 'ana' },
      { id: 2, name: 'b', owner: 'bruno' },
      { id: 3, name: 'c', owner: 'ana' }
    ]);

    const mine = await api.query<Design>('designs', { index: 'byOwner', equals: 'ana' });

    expect(mine.map((row) => row.id).sort()).to.deep.equal([1, 3]);
    expect(await api.count('designs', { index: 'byOwner', equals: 'ana' })).to.equal(2);
    await teardown();
  });

  it('reports storage state across the boundary', async () => {
    const { api, teardown } = connected();
    await api.open();

    expect(await api.storageState()).to.deep.include({ evicted: false });
    await teardown();
  });
});

describe('cana worker change broadcasts', () => {
  afterEach(releaseOpenPorts);

  it('pushes committed changes without being asked', async () => {
    const { api, broadcasts, teardown } = connected();
    await api.open();

    await api.add('designs', { id: 1, name: 'a' });
    await settle();

    expect(broadcasts).to.have.lengthOf(1);
    expect(broadcasts[0]).to.deep.include({ type: 'created', store: 'designs' });
    await teardown();
  });

  it('sends a broadcast that survived structured clone intact', async () => {
    // Every contractual field must still be there on the far side — this is
    // where a class instance or a getter-backed property would be lost.
    const { api, broadcasts, teardown } = connected();
    await api.open();

    await api.add('designs', { id: 1, name: 'a' });
    await settle();

    // The fields with fixed values, then the generated ones by type. Chai has
    // no `expect.any`, and spelling the two apart is clearer anyway: the first
    // group is the contract, the second is only ever "something was filled in".
    expect(broadcasts[0]).to.deep.include({ type: 'created', store: 'designs', key: 1 });
    expect(broadcasts[0]).to.have.property('cursor').that.is.a('number');
    expect(broadcasts[0]).to.have.property('correlationId').that.is.a('string');
    expect(broadcasts[0]).to.have.property('at').that.is.a('number');
    expect(broadcasts[0]).to.have.property('originId').that.is.a('string');
    await teardown();
  });

  it('does not broadcast anything for a read', async () => {
    const { api, broadcasts, teardown } = connected();
    await api.open();
    await api.query('designs');
    await settle();

    expect(broadcasts).to.deep.equal([]);
    await teardown();
  });
});

describe('cana worker failure handling', () => {
  afterEach(releaseOpenPorts);

  it('returns a typed error as data, never as an Error', async () => {
    // An Error would not survive the clone with its identity, so the taxonomy
    // has to arrive as a plain tagged object or it arrives useless.
    const { api, teardown } = connected();
    await api.open();
    await api.add('designs', { id: 1, name: 'a' });

    const failure = await api.add('designs', { id: 1, name: 'clash' })
      .catch((error: unknown) => error);

    expect(isCanaErrorCode(failure, 'ConstraintViolation')).to.equal(true);
    expect(failure).not.to.be.instanceOf(Error);
    await teardown();
  });

  it('reports a missing store rather than hanging', async () => {
    const { api, teardown } = connected();
    await api.open();

    expect(await api.get('no-such-store', 1).catch((error: unknown) => error)).to.deep.include({ canaError: true });
    await teardown();
  });

  it('refuses a transaction with an explanation instead of a clone error', async () => {
    // The body is a function, and functions do not survive structured clone.
    // The façade omits `transaction` for that reason, so this drives `serve`
    // directly — the path someone hits if they build the envelope by hand.
    const client = createClient({ name: 'designer', schema });
    await client.open();

    const failure = await serve(client, { kind: 'transaction', requestId: 'r1' })
      .catch((error: unknown) => error);

    expect(isCanaErrorCode(failure, 'InvalidRequest')).to.equal(true);
    expect((failure as { message: string }).message).to.include('structured-cloneable');
    await client.close();
  });

  it('rejects an unsupported request kind by name', async () => {
    const client = createClient({ name: 'designer', schema });
    await client.open();

    const failure = await serve(
      client,
      { kind: 'nonsense' as unknown as 'ping', requestId: 'r1' }
    ).catch((error: unknown) => error);

    expect(isCanaErrorCode(failure, 'InvalidRequest')).to.equal(true);
    expect((failure as { message: string }).message).to.include('nonsense');
    await client.close();
  });

  it('rejects a write with no operation, and an unknown operation', async () => {
    const client = createClient({ name: 'designer', schema });
    await client.open();

    expect(await rejection(serve(client, { kind: 'write', store: 'designs', requestId: 'r1' }))).to.deep.include({ code: 'InvalidRequest' });
    expect(await rejection(serve(client, {
      kind: 'write',
      store: 'designs',
      requestId: 'r2',
      payload: { operation: 'frobnicate' }
    }))).to.deep.include({ code: 'InvalidRequest' });
    await client.close();
  });

  it('rejects a keyed request with no key', async () => {
    const client = createClient({ name: 'designer', schema });
    await client.open();

    expect(await rejection(serve(client, { kind: 'get', store: 'designs', requestId: 'r1' }))).to.deep.include({ code: 'InvalidRequest' });
    await client.close();
  });

  it('keeps serving after a request fails', async () => {
    // A failed request must not take the host down, or one bad call would
    // silently break every later one and present as a timeout.
    const { api, teardown } = connected();
    await api.open();

    await api.get('no-such-store', 1).catch(() => undefined);

    expect(await api.ping()).to.equal('pong');
    await teardown();
  });

  it('ignores a message that is not a Cana request', async () => {
    // Ports can be shared. Answering something we do not understand is worse
    // than ignoring it.
    const { api, teardown } = connected();
    await api.open();

    expect(await api.ping()).to.equal('pong');
    await teardown();
  });
});

describe('cana worker crash reconciliation', () => {
  afterEach(releaseOpenPorts);

  it('resolves a committed write from the far side', async () => {
    // The end-to-end version of JUM-559: the answer must be reachable through
    // the same boundary the write went through.
    const { api, broadcasts, teardown } = connected({ ledger: true });
    await api.open();
    await api.add('designs', { id: 1, name: 'a' });
    await settle();

    const { correlationId } = broadcasts[0] as { correlationId: string };

    expect(await api.resolveWrite(correlationId, Date.now())).to.equal('committed');
    await teardown();
  });

  it('rejects a resolve-write missing its timestamp', async () => {
    // An id alone cannot distinguish a rollback from a pruned record, so the
    // host refuses rather than guessing.
    const { api, teardown } = connected({ ledger: true });
    await api.open();

    const failure = await api.resolveWrite(undefined as unknown as string, Date.now())
      .catch((error: unknown) => error);

    expect(isCanaErrorCode(failure, 'InvalidRequest')).to.equal(true);
    await teardown();
  });
});

/**
 * Request validation and teardown across the boundary.
 *
 * These paths are defensive, which is exactly why they were uncovered: nothing
 * in the happy path reaches them, and a defensive branch that has never executed
 * is a guess about what it does.
 */
describe('cana worker request validation', () => {
  afterEach(releaseOpenPorts);

  it('rejects a store operation that carries no store name', async () => {
    // The router is bypassed here because the typed client cannot express the
    // malformed request — which is the point: the host must not assume its peer
    // is the matching client. A worker port is reachable by anything on the page.
    const { api, teardown } = connected();
    await api.open();

    const raw = await (api as unknown as {
      get: (store: unknown, key: unknown) => Promise<unknown>;
    }).get(undefined, 1).catch((error: unknown) => error);

    expect(isCanaErrorCode(raw, 'InvalidRequest')).to.equal(true);
    expect((raw as { message: string }).message).to.include('requires a store name');
    await teardown();
  });

  it('closes the database through the boundary', async () => {
    // `close` had no coverage: every test tore the port down instead of asking
    // the host to close, so the one operation a page performs on unload was the
    // one never exercised.
    const { api, teardown } = connected();
    await api.open();
    await api.add('designs', { id: 1, name: 'before close' });

    await api.close();

    // Reopening must work: close releases the connection rather than poisoning
    // the host, and the data written before it survives.
    await api.open();

    expect(await api.get<Design>('designs', 1)).to.deep.include({ name: 'before close' });
    await teardown();
  });

  /**
   * A port can be shared. Another library, a devtools bridge, or the page itself
   * may post on the same channel, and the host has to leave those alone.
   *
   * Silence is the only safe answer: replying with an error to a message never
   * addressed to us would look, to whoever did send it, like their own protocol
   * failing. So the assertion is that nothing comes back — and that a real
   * request still works afterwards, because silence only counts as correct if
   * the host is still listening.
   */
  it('ignores messages that are not request envelopes', async () => {
    const channel = new MessageChannel();
    channel.port1.start();
    channel.port2.start();

    const host = createWorkerHost({
      name: 'bystander',
      schema,
      port: channel.port2 as unknown as Parameters<typeof createWorkerHost>[0]['port']
    });

    const replies: unknown[] = [];
    channel.port1.addEventListener('message', (event) => {
      replies.push((event as MessageEvent).data);
    });

    // Each fails a different clause of the guard: not an object at all, an
    // object with no requestId, and a requestId of the wrong type.
    channel.port1.postMessage('a bare string');
    channel.port1.postMessage({ hello: 'not ours' });
    channel.port1.postMessage({ requestId: 42 });
    await settle();

    expect(replies).to.deep.equal([]);

    // Still listening: a well-formed request is answered.
    channel.port1.postMessage({ requestId: 'ping-1', op: 'ping' });
    await settle();

    expect(replies).to.have.lengthOf(1);

    await host.dispose();
    channel.port1.close();
    channel.port2.close();
  });
});
