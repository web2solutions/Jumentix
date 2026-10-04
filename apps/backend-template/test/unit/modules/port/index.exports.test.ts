describe('port module exports', () => {
  it('exposes runtime exports through the barrel file', async () => {
    expect.hasAssertions();
    const PortModule = await import('@src/modules/port');
    const keys = Object.keys(PortModule);
    expect(keys.length).toBeGreaterThan(10);

    for (const key of keys) {
      expect((PortModule as any)[key]).toBeDefined();
    }
  });
});
