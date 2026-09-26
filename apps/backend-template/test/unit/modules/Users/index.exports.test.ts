describe('users module exports', () => {
  it('exposes all runtime exports through the barrel file', async () => {
    expect.hasAssertions();
    const UsersModule = await import('@src/modules/Users');
    const keys = Object.keys(UsersModule);
    expect(keys.length).toBeGreaterThan(40);

    for (const key of keys) {
      expect((UsersModule as any)[key]).toBeDefined();
    }
  });
});
