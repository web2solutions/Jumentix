const { withPm2DaemonLock } = require('../../src/runtime/pm2DaemonLock');

/**
 * JUM-770: the pm2 module is a singleton — overlapping connect/disconnect
 * cycles killed in-flight RPCs (stop/restart hung forever). The lock must
 * serialize critical sections even when they overlap in time.
 */
describe('service-management pm2DaemonLock', () => {
  it('serializes overlapping sections in call order', async () => {
    expect.hasAssertions();
    const events: string[] = [];
    const delayed = (label: string, ms: number) => withPm2DaemonLock(async () => {
      events.push(`${label}:enter`);
      await new Promise((resolve) => { setTimeout(resolve, ms); });
      events.push(`${label}:exit`);
    });
    await Promise.all([delayed('slow', 30), delayed('fast', 1)]);
    expect(events).toStrictEqual(['slow:enter', 'slow:exit', 'fast:enter', 'fast:exit']);
  });

  it('keeps the chain alive after a rejected section', async () => {
    expect.hasAssertions();
    const failure = withPm2DaemonLock(async () => {
      throw new Error('daemon blew up');
    });
    await expect(failure).rejects.toThrow('daemon blew up');
    await expect(withPm2DaemonLock(async () => 'recovered')).resolves.toBe('recovered');
  });
});
