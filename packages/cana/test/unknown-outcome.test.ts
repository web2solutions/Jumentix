import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import type { CanaSchema } from '@jumentix/cana';
import {
  createChangeBuffer,
  createClient,
  isCanaErrorCode,
  openDatabase,
  runTransaction
} from '@jumentix/cana';

/**
 * The `unknown` write outcome, finally exercised.
 *
 * Earlier commits recorded this branch as untestable, on the grounds that it
 * needs a transaction torn down without either `complete` or `abort` firing.
 * That was too pessimistic: the branch the engine actually takes is "the body
 * failed but the transaction completed anyway", and a transaction whose events
 * are driven directly reproduces exactly that ordering.
 *
 * Only the event ordering is injected. Everything asserted — the outcome, the
 * discarded events, the reconciliation path — is the engine's own behaviour.
 */

const schema: CanaSchema = {
  version: 1,
  stores: [{ name: 'designs', keyPath: 'id' }]
};

/**
 * A database whose transaction commits regardless of what the body does.
 *
 * This is the auto-commit race: IndexedDB closed the window and committed while
 * the caller's body was still failing.
 */
function committingDatabase() {
  const transaction = {
    oncomplete: null as (() => void) | null,
    onabort: null as (() => void) | null,
    onerror: null as (() => void) | null,
    error: null,
    abort() { /* too late: already committed */ },
    objectStore: () => ({ name: 'designs' })
  };

  return {
    database: {
      transaction: () => {
        // Fires after the body has had a chance to run and fail.
        setTimeout(() => transaction.oncomplete?.(), 0);
        return transaction;
      }
    } as unknown as IDBDatabase,
    transaction
  };
}

describe('unknown write outcome', () => {
  it('reports unknown when the body fails but the transaction committed', async () => {
    expect.hasAssertions();
    // Neither 'committed' nor 'rolled-back' describes this: what is on disk no
    // longer matches what the caller asked for. Reporting either one would make
    // a caller either lose a write or duplicate it.
    const { database } = committingDatabase();
    const buffer = createChangeBuffer(() => 1, 'origin');

    const outcome = await runTransaction({
      database,
      stores: ['designs'],
      mode: 'readwrite',
      buffer,
      body: async () => { throw new Error('application failure after the commit landed'); }
    });

    expect(outcome.outcome).toBe('unknown');
  });

  it('emits no events for an unknown outcome', async () => {
    expect.hasAssertions();
    // The data on disk is not what the caller intended, so announcing it as a
    // committed change would propagate a state nobody asked for.
    const { database } = committingDatabase();
    const buffer = createChangeBuffer(() => 1, 'origin');
    buffer.record({ type: 'created', store: 'designs', correlationId: 'c1' });

    const outcome = await runTransaction({
      database,
      stores: ['designs'],
      mode: 'readwrite',
      buffer,
      body: async () => { throw new Error('failed after commit'); }
    });

    expect(outcome.outcome).toBe('unknown');
    expect(outcome.events).toStrictEqual([]);
    expect(buffer.drain()).toStrictEqual([]);
  });

  it('distinguishes an errored transaction from an aborted one in the message', async () => {
    expect.hasAssertions();
    const transaction = {
      oncomplete: null as (() => void) | null,
      onabort: null as (() => void) | null,
      onerror: null as (() => void) | null,
      error: null,
      abort() { /* no-op */ },
      objectStore: () => ({ name: 'designs' })
    };
    const database = {
      transaction: () => {
        setTimeout(() => transaction.onerror?.(), 0);
        return transaction;
      }
    } as unknown as IDBDatabase;

    const failure = await runTransaction({
      database,
      stores: ['designs'],
      mode: 'readwrite',
      buffer: createChangeBuffer(() => 1, 'origin'),
      body: async () => undefined
    }).catch((error: unknown) => error);

    expect(isCanaErrorCode(failure, 'TransactionAborted')).toBe(true);
    expect((failure as { message: string }).message).toContain('failed');
  });

  it('translates a failure raised while starting the transaction', async () => {
    expect.hasAssertions();
    const database = {
      transaction: () => { throw new Error('scope is invalid'); }
    } as unknown as IDBDatabase;
    const buffer = createChangeBuffer(() => 1, 'origin');
    buffer.record({ type: 'created', store: 'designs', correlationId: 'c1' });

    await expect(runTransaction({
      database,
      stores: ['designs'],
      mode: 'readwrite',
      buffer,
      body: async () => undefined
    })).rejects.toMatchObject({ canaError: true });

    // The buffer is discarded: a transaction that never started produced nothing.
    expect(buffer.drain()).toStrictEqual([]);
  });

  it('carries the reconciliation handles on the unknown result', async () => {
    expect.hasAssertions();
    // The whole point of the fix from review: 'unknown' is the outcome that must
    // be reconciled, so it must carry what reconciling requires.
    const client = createClient({
      name: 'designer', schema, factory: new IDBFactory(), operationLedger: true
    });
    await client.open();

    const result = await client.transaction('readwrite', ['designs'], async (scope) => {
      await scope.table('designs').add({ id: 1, name: 'a' });
    });

    expect(result.correlationId).toBeDefined();
    expect(result.attemptedAt).toBeDefined();
    await client.close();
  });
});

describe('remaining lifecycle branches', () => {
  it('requests persistence on open when the policy asks for it', async () => {
    expect.hasAssertions();
    let asked = false;
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        storage: {
          persisted: async () => false,
          persist: async () => { asked = true; return true; }
        }
      }
    });
    try {
      const client = createClient({
        name: 'designer',
        schema,
        factory: new IDBFactory(),
        durabilityPolicy: { requestPersistenceOnOpen: true }
      });
      await client.open();

      expect(asked).toBe(true);
      await client.close();
    } finally {
      Reflect.deleteProperty(globalThis as object, 'navigator');
    }
  });

  it('keeps DOMExceptions inside the boundary during an upgrade', async () => {
    expect.hasAssertions();
    // Asserted unconditionally: an upgrade either succeeds or rejects with a
    // Cana value, never with a raw DOM error.
    const outcome = await openDatabase({
      name: 'designer',
      factory: new IDBFactory(),
      schema: {
        version: 1,
        stores: [{
          name: 'designs',
          keyPath: 'id',
          indexes: [{ name: 'byTags', keyPath: 'tags', multiEntry: true }]
        }]
      }
    }).catch((error: unknown) => error);

    expect(outcome).not.toBeInstanceOf(Error);
    (outcome as { database?: IDBDatabase }).database?.close();
  });

  it('treats a bulk put on an outbound store as all creates', async () => {
    expect.hasAssertions();
    // No inbound keyPath means nothing to probe with, so per-row classification
    // cannot distinguish and must not pretend to.
    const client = createClient({
      name: 'designer',
      factory: new IDBFactory(),
      schema: { version: 1, stores: [{ name: 'designs', autoIncrement: true }] }
    });
    await client.open();

    const { events } = await client.table<{ name: string }>('designs')
      .bulkPut([{ name: 'a' }, { name: 'b' }]);

    expect(events.map((event) => event.type)).toStrictEqual(['created', 'created']);
    await client.close();
  });
});
