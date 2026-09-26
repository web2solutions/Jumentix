import InMemoryDbClient from '@src/infra/persistence/InMemoryDatabase/InMemoryDbClient';

describe('in-memory db client', () => {
  it('exposes stores and connect/disconnect operations', async () => {
    expect.hasAssertions();
    expect(typeof InMemoryDbClient.stores.User).toBe('object');
    expect(typeof InMemoryDbClient.stores.Organization).toBe('object');
    await expect(InMemoryDbClient.connect()).resolves.toBeUndefined();
    await expect(InMemoryDbClient.disconnect()).resolves.toBeUndefined();
  });
});
