import { UserService } from '@src/modules/Users/service/UserService';
import { DeadLetterQueue } from '@jumentix/dead-letter-queue';

/**
 * JUM-53 — a write the mutex refuses is recorded, and still refused.
 *
 * Both halves are the requirement. Recording without refusing would tell the
 * caller a write happened when it has not; refusing without recording is the
 * behaviour this task exists to replace.
 */
/** The service validates the id before it ever reaches the mutex. */
const USER_ID = '00000000-0000-4000-8000-000000000001';

function setup(deadLetterQueue?: unknown) {
  const mutexService = {
    lock: jest.fn().mockResolvedValue({ result: { previouslyLocked: true } }),
    isLocked: jest.fn().mockResolvedValue({ result: true }),
    unlock: jest.fn().mockResolvedValue({ result: true })
  };
  const dataRepository = {
    getOneById: jest.fn().mockResolvedValue({ id: USER_ID, roles: [], organization: '' })
  };
  const service = new UserService({
    dataRepository: dataRepository as never,
    services: {
      mutexService,
      passwordCryptoService: { hash: jest.fn(), compare: jest.fn() },
      ...(deadLetterQueue ? { deadLetterQueue } : {})
    }
  } as never);

  return { service, mutexService };
}

describe('userService dead-letter capture (JUM-53)', () => {
  it('records the refused write with what a replay needs', async () => {
    expect.hasAssertions();

    const queue = new DeadLetterQueue();
    const { service } = setup(queue);

    await service.update(USER_ID, { firstName: 'Mary' } as never);
    const pending = await queue.pending();

    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      entityName: 'User',
      resourceId: USER_ID,
      operation: 'update',
      payload: { firstName: 'Mary' },
      status: 'pending'
    });
  });

  it('still refuses the write, because it has not happened', async () => {
    expect.hasAssertions();

    // The failure this guards against is a queued write reported as a success.
    const queue = new DeadLetterQueue();
    const { service } = setup(queue);

    const response = await service.update(USER_ID, { firstName: 'Mary' } as never);

    expect(response.error).toBeDefined();
    expect(String((response.error as Error).message)).toContain('is locked');
    expect(response.result).toBeUndefined();
  });

  it('behaves exactly as before when no queue is wired', async () => {
    expect.hasAssertions();

    const { service } = setup();

    const response = await service.update(USER_ID, { firstName: 'Mary' } as never);

    expect(response.error).toBeDefined();
  });

  it('reports the lock, not the outage, when the queue itself fails', async () => {
    expect.hasAssertions();

    // A Redis failure must not replace "the resource is locked" with something
    // the caller cannot act on, and must not hide the real cause.
    const failing = { enqueue: jest.fn().mockRejectedValue(new Error('redis unreachable')) };
    const { service } = setup(failing);

    const response = await service.update(USER_ID, { firstName: 'Mary' } as never);

    expect(failing.enqueue).toHaveBeenCalledTimes(1);
    expect(String((response.error as Error).message)).toContain('is locked');
    expect(String((response.error as Error).message)).not.toContain('redis');
  });

  it('records the aggregate operations under their own names', async () => {
    expect.hasAssertions();

    // Twelve sites share one helper; the operation name is what tells a replay
    // handler which one to run, so a wrong name is a silently unreplayable
    // record.
    const queue = new DeadLetterQueue();
    const { service } = setup(queue);

    await service.deletePhone(USER_ID, 'phone-1');
    await service.updateEmail(USER_ID, 'email-1', { email: 'a@b.c' } as never);
    const pending = await queue.pending();

    expect(pending.map((record) => record.operation)).toStrictEqual(['deletePhone', 'updateEmail']);
    expect(pending[1].payload).toMatchObject({ emailId: 'email-1' });
  });
});
