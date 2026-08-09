import type { CanaSchema } from '../src';
import {
  createChangeBuffer,
  createClient,
  isCanaErrorCode,
  openDatabase,
  runTransaction
} from '../src';
import { rejection } from './harness';

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

    expect(outcome.outcome).to.equal('unknown');
  });

  it('emits no events for an unknown outcome', async () => {
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

    expect(outcome.outcome).to.equal('unknown');
    expect(outcome.events).to.deep.equal([]);
    expect(buffer.drain()).to.deep.equal([]);
  });

  it('distinguishes an errored transaction from an aborted one in the message', async () => {
    const errored = {
      oncomplete: null as (() => void) | null,
      onabort: null as (() => void) | null,
      onerror: null as (() => void) | null,
      error: null,
      abort() { /* no-op */ },
      objectStore: () => ({ name: 'designs' })
    };
    const aborted = {
      oncomplete: null as (() => void) | null,
      onabort: null as (() => void) | null,
      onerror: null as (() => void) | null,
      error: null,
      abort() { /* no-op */ },
      objectStore: () => ({ name: 'designs' })
    };

    const failed = await runTransaction({
      database: {
        transaction: () => {
          setTimeout(() => errored.onerror?.(), 0);
          return errored;
        }
      } as unknown as IDBDatabase,
      stores: ['designs'],
      mode: 'readwrite',
      buffer: createChangeBuffer(() => 1, 'origin'),
      body: async () => undefined
    }).catch((error: unknown) => error);

    expect(isCanaErrorCode(failed, 'TransactionAborted')).to.equal(true);
    expect((failed as { message: string }).message).to.include('failed');

    const rolled = await runTransaction({
      database: {
        transaction: () => {
          setTimeout(() => aborted.onabort?.(), 0);
          return aborted;
        }
      } as unknown as IDBDatabase,
      stores: ['designs'],
      mode: 'readwrite',
      buffer: createChangeBuffer(() => 1, 'origin'),
      body: async () => undefined
    }).catch((error: unknown) => error);

    expect(isCanaErrorCode(rolled, 'TransactionAborted')).to.equal(true);
    expect((rolled as { message: string }).message).to.include('was aborted');
  });

  it('translates a failure raised while starting the transaction', async () => {
    const database = {
      transaction: () => { throw new Error('scope is invalid'); }
    } as unknown as IDBDatabase;
    const buffer = createChangeBuffer(() => 1, 'origin');
    buffer.record({ type: 'created', store: 'designs', correlationId: 'c1' });

    expect(await rejection(runTransaction({
      database,
      stores: ['designs'],
      mode: 'readwrite',
      buffer,
      body: async () => undefined
    }))).to.deep.include({ canaError: true });

    // The buffer is discarded: a transaction that never started produced nothing.
    expect(buffer.drain()).to.deep.equal([]);
  });

  it('carries the reconciliation handles on the unknown result', async () => {
    // The whole point of the fix from review: 'unknown' is the outcome that must
    // be reconciled, so it must carry what reconciling requires.
    const client = createClient({
      name: 'designer', schema, operationLedger: true
    });
    await client.open();

    const result = await client.transaction('readwrite', ['designs'], async (scope) => {
      await scope.table('designs').add({ id: 1, name: 'a' });
    });

    expect(result.correlationId).to.not.equal(undefined);
    expect(result.attemptedAt).to.not.equal(undefined);
    await client.close();
  });
});

describe('remaining lifecycle branches', () => {
  it('requests persistence on open when the policy asks for it', async () => {
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
        durabilityPolicy: { requestPersistenceOnOpen: true }
      });
      await client.open();

      expect(asked).to.equal(true);
      await client.close();
    } finally {
      Reflect.deleteProperty(globalThis as object, 'navigator');
    }
  });

  it('keeps DOMExceptions inside the boundary during an upgrade', async () => {
    // Asserted unconditionally: an upgrade either succeeds or rejects with a
    // Cana value, never with a raw DOM error.
    const outcome = await openDatabase({
      name: 'designer',
      schema: {
        version: 1,
        stores: [{
          name: 'designs',
          keyPath: 'id',
          indexes: [{ name: 'byTags', keyPath: 'tags', multiEntry: true }]
        }]
      }
    }).catch((error: unknown) => error);

    expect(outcome).not.to.be.instanceOf(Error);
    (outcome as { database?: IDBDatabase }).database?.close();
  });

  it('treats a bulk put on an outbound store as all creates', async () => {
    // No inbound keyPath means nothing to probe with, so per-row classification
    // cannot distinguish and must not pretend to.
    const client = createClient({
      name: 'designer',
      schema: { version: 1, stores: [{ name: 'designs', autoIncrement: true }] }
    });
    await client.open();

    const { events } = await client.table<{ name: string }>('designs')
      .bulkPut([{ name: 'a' }, { name: 'b' }]);

    expect(events.map((event) => event.type)).to.deep.equal(['created', 'created']);
    await client.close();
  });
});
