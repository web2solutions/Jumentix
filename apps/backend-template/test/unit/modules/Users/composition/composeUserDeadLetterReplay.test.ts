import { DeadLetterQueue } from '@jumentix/dead-letter-queue';
import {
  composeUserDeadLetterQueue,
  composeUserDeadLetterWorker,
  userReplayHandlers
} from '@src/modules/Users/composition/composeUserDeadLetterReplay';

/**
 * JUM-53 — replaying through the service, and the false green that hides in it.
 *
 * `UserService` reports failure in `response.error` and does not throw. A
 * handler that ignored that would return normally for a still-locked record,
 * the queue would mark it `succeeded`, and the write would be lost while the
 * report said it landed.
 */
const RESOURCE = '00000000-0000-4000-8000-000000000001';

function serviceDouble(response: { error?: unknown } = {}) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const record = (method: string) => (...args: unknown[]) => {
    calls.push({ method, args });
    return Promise.resolve(response);
  };
  return {
    calls,
    update: record('update'),
    delete: record('delete'),
    updatePassword: record('updatePassword'),
    createDocument: record('createDocument'),
    updateDocument: record('updateDocument'),
    deleteDocument: record('deleteDocument'),
    createPhone: record('createPhone'),
    updatePhone: record('updatePhone'),
    deletePhone: record('deletePhone'),
    createEmail: record('createEmail'),
    updateEmail: record('updateEmail'),
    deleteEmail: record('deleteEmail')
  };
}

describe('user dead-letter replay composition (JUM-53)', () => {
  it('covers every operation the service can refuse for a lock', () => {
    expect.hasAssertions();

    // Twelve rejection sites; a missing handler makes its records unreplayable
    // and they are skipped for ever without anything reporting it.
    const handlers = userReplayHandlers(serviceDouble() as never);

    expect(Object.keys(handlers).sort()).toStrictEqual([
      'createDocument', 'createEmail', 'createPhone', 'delete', 'deleteDocument',
      'deleteEmail', 'deletePhone', 'update', 'updateDocument', 'updateEmail',
      'updatePassword', 'updatePhone'
    ]);
  });

  it('marks a record succeeded only when the service actually wrote', async () => {
    expect.hasAssertions();

    const service = serviceDouble();
    const queue = new DeadLetterQueue();
    await queue.enqueue({
      entityName: 'User', resourceId: RESOURCE, operation: 'update', payload: { firstName: 'Ada' }
    });

    const report = await queue.replay(userReplayHandlers(service as never));

    expect(report.replayed).toHaveLength(1);
    expect(service.calls).toStrictEqual([
      { method: 'update', args: [RESOURCE, { firstName: 'Ada' }] }
    ]);
  });

  it('keeps a record queued when the service reports the lock in `error`', async () => {
    expect.hasAssertions();

    // The decisive one. The service resolves rather than throwing, so without
    // the `error` check this would report a success and drop the write.
    const service = serviceDouble({ error: new Error('User is locked') });
    const queue = new DeadLetterQueue();
    await queue.enqueue({
      entityName: 'User', resourceId: RESOURCE, operation: 'update', payload: { firstName: 'Ada' }
    });

    const report = await queue.replay(userReplayHandlers(service as never));

    expect(report.replayed).toStrictEqual([]);
    expect(report.retried).toHaveLength(1);
    const [pending] = await queue.pending();

    expect(pending.attempts).toBe(1);
    expect(pending.lastError).toBe('User is locked');
  });

  it('unpacks the aggregate payloads into the right arguments', async () => {
    expect.hasAssertions();

    const service = serviceDouble();
    const queue = new DeadLetterQueue();
    await queue.enqueue({
      entityName: 'User',
      resourceId: RESOURCE,
      operation: 'updatePhone',
      payload: { phoneId: 'phone-1', data: { number: '123' } }
    });
    await queue.enqueue({
      entityName: 'User', resourceId: RESOURCE, operation: 'deleteEmail', payload: { emailId: 'email-1' }
    });

    await queue.replay(userReplayHandlers(service as never));

    expect(service.calls).toStrictEqual([
      { method: 'updatePhone', args: [RESOURCE, 'phone-1', { number: '123' }] },
      { method: 'deleteEmail', args: [RESOURCE, 'email-1'] }
    ]);
  });

  it('builds nothing without a shared store', () => {
    expect.hasAssertions();

    // A process-local queue would be lost on restart while looking durable.
    expect(composeUserDeadLetterQueue(undefined)).toBeUndefined();
    expect(composeUserDeadLetterWorker(undefined, serviceDouble() as never)).toBeUndefined();
  });

  it('builds a queue and a worker when a store is present, and does not start it', () => {
    expect.hasAssertions();

    const client = {
      get: jest.fn().mockResolvedValue({ result: undefined }),
      set: jest.fn().mockResolvedValue({ result: 'OK' }),
      del: jest.fn().mockResolvedValue({ result: 1 })
    };
    const queue = composeUserDeadLetterQueue(client as never);
    const worker = composeUserDeadLetterWorker(queue, serviceDouble() as never);

    expect(queue).toBeDefined();
    // Composition builds; starting a background timer is the runtime's call,
    // and more importantly so is stopping it.
    expect(worker?.running).toBe(false);
  });
});
