import { UserService } from '@src/modules/Users/service/UserService';

/**
 * JUM-663 — a caller the mutex refused must not release the lock.
 *
 * Every mutating method ends with `unlock` in its `catch`. A caller refused by
 * the mutex reaches that `catch` without ever having acquired anything, so the
 * unlock freed the writer that *did* hold the lock — letting a third writer in
 * while the first was still mid-write. That is the corruption the mutex exists
 * to prevent, and no test saw it because the refused caller still got its
 * error and the holder still finished its own write.
 */
const RESOURCE = '00000000-0000-4000-8000-000000000001';

function setup(previouslyLocked: boolean) {
  const mutexService = {
    lock: jest.fn().mockResolvedValue({ result: { previouslyLocked } }),
    isLocked: jest.fn().mockResolvedValue({ result: previouslyLocked }),
    unlock: jest.fn().mockResolvedValue({ result: true })
  };
  const dataRepository = {
    getOneById: jest.fn().mockResolvedValue({ id: RESOURCE, roles: [], organization: '' })
  };
  const service = new UserService({
    dataRepository: dataRepository as never,
    services: { mutexService, passwordCryptoService: { hash: jest.fn(), compare: jest.fn() } }
  } as never);

  return { service, mutexService };
}

describe('userService lock release (JUM-663)', () => {
  it('does not unlock a resource it was refused', async () => {
    expect.hasAssertions();

    const { service, mutexService } = setup(true);

    const response = await service.update(RESOURCE, { firstName: 'Mary' } as never);

    expect(String((response.error as Error).message)).toContain('is locked');
    // The decisive assertion. Before JUM-663 this was one call, and it released
    // the lock of whichever writer was mid-write.
    expect(mutexService.unlock).not.toHaveBeenCalled();
  });

  it('still unlocks when the write itself failed', async () => {
    expect.hasAssertions();

    // The other direction: a lock this caller *did* acquire has to come back,
    // or one bad write leaves the resource locked for ever.
    const { service, mutexService } = setup(false);
    (service as unknown as { dataRepository: { getOneById: jest.Mock } })
      .dataRepository.getOneById.mockRejectedValue(new Error('database down'));

    const response = await service.update(RESOURCE, { firstName: 'Mary' } as never);

    expect(response.error).toBeDefined();
    expect(mutexService.unlock).toHaveBeenCalledWith('User', RESOURCE);
  });

  it('applies to the aggregate operations too, not only update', async () => {
    expect.hasAssertions();

    // Twelve methods share the shape; a guard on one of them would read as a
    // fix while eleven kept releasing other writers' locks.
    const { service, mutexService } = setup(true);

    await service.deletePhone(RESOURCE, 'phone-1');
    await service.updateEmail(RESOURCE, 'email-1', { email: 'a@b.c' } as never);
    await service.delete(RESOURCE);

    expect(mutexService.unlock).not.toHaveBeenCalled();
  });
});
