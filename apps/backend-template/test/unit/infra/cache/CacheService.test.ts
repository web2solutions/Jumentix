import { CacheService } from '@src/infra/cache';

describe('cache service', () => {
  const setup = () => {
    const storage = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn()
    };
    const service = CacheService.compile({
      keyValueStorageClient: storage as any
    });
    return { service, storage };
  };

  it('stores and retrieves cache envelopes', async () => {
    expect.hasAssertions();
    const { service, storage } = setup();
    storage.get.mockResolvedValueOnce({
      result: {
        value: { id: 'u1' }
      }
    });

    await service.set('users:key', { id: 'u1' });
    expect(storage.set).toHaveBeenCalledWith(
      'users:key',
      expect.objectContaining({
        value: { id: 'u1' }
      })
    );

    const cached = await service.get<{ id: string }>('users:key');
    expect(cached).toStrictEqual({ id: 'u1' });
  });

  it('returns raw values from storage when payload is not an envelope', async () => {
    expect.hasAssertions();
    const { service, storage } = setup();
    storage.get.mockResolvedValueOnce({ result: 'raw-value' });
    const cached = await service.get<string>('raw:key');
    expect(cached).toBe('raw-value');
  });

  it('expires ttl-based values and deletes stale keys', async () => {
    expect.hasAssertions();
    const { service, storage } = setup();
    storage.get.mockResolvedValueOnce({
      result: {
        value: { id: 'u2' },
        expiresAt: Date.now() - 5
      }
    });

    const cached = await service.get<{ id: string }>('users:expired');
    expect(cached).toBeUndefined();
    expect(storage.del).toHaveBeenCalledWith('users:expired');
  });

  it('sets ttl metadata and supports explicit key deletion', async () => {
    expect.hasAssertions();
    const { service, storage } = setup();
    await service.set('users:ttl', { id: 'u3' }, 60);
    expect(storage.set).toHaveBeenCalledWith(
      'users:ttl',
      expect.objectContaining({
        value: { id: 'u3' },
        expiresAt: expect.any(Number)
      })
    );

    await service.del('users:ttl');
    expect(storage.del).toHaveBeenCalledWith('users:ttl');
  });

  it('maintains cache namespace versions', async () => {
    expect.hasAssertions();
    const { service, storage } = setup();
    storage.get
      .mockResolvedValueOnce({ result: undefined })
      .mockResolvedValueOnce({ result: { value: 1 } })
      .mockResolvedValueOnce({ result: { value: 1 } });

    const initial = await service.getVersion('users');
    expect(initial).toBe(1);

    const bumped = await service.bumpVersion('users');
    expect(bumped).toBe(2);
    expect(storage.set).toHaveBeenCalledWith('cache:version:users', { value: 2 });
  });
});
