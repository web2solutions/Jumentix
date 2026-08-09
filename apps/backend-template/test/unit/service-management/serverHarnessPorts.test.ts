/* eslint-disable jest/prefer-expect-assertions, jest/max-expects, jest/no-conditional-in-test */
/*
 * JUM-628 — unit contract for the ServiceManagement harness port allocator
 * (`runWithPortRetry`): bounded retry with a fresh random port on EADDRINUSE,
 * a clear error once the attempts are exhausted, no retry for non-bind
 * failures, and no port movement for pinned origins.
 */
import {
  DEFAULT_PORT_ATTEMPTS,
  isAddrInUseError,
  runWithPortRetry
} from '../../integration/ServiceManagement/serverHarness';

function addrInUse(port: number): NodeJS.ErrnoException {
  const error: NodeJS.ErrnoException = new Error(
    `port ${String(port)} is already in use (EADDRINUSE)`
  );
  error.code = 'EADDRINUSE';
  return error;
}

describe('serverHarness port allocation (JUM-628)', () => {
  it('retries with a fresh port on EADDRINUSE and succeeds within the bound', async () => {
    const candidates = [3301, 3302, 3303];
    const triedPorts: number[] = [];
    const retries: Array<{ port: number; attempt: number; maxAttempts: number }> = [];

    const result = await runWithPortRetry({
      pickPort: () => candidates[triedPorts.length],
      attempt: (port) => {
        triedPorts.push(port);
        if (triedPorts.length < 3) {
          return Promise.reject(addrInUse(port));
        }
        return Promise.resolve(`ready:${String(port)}`);
      },
      onRetry: (event) => retries.push(event)
    });

    expect(result).toBe('ready:3303');
    // Every retry must have moved to a DIFFERENT port — re-trying the busy
    // one would be the single-shot bug all over again.
    expect(triedPorts).toStrictEqual([3301, 3302, 3303]);
    // The retry is logged (the harness wires this to console.warn).
    expect(retries).toStrictEqual([
      { port: 3301, attempt: 1, maxAttempts: DEFAULT_PORT_ATTEMPTS },
      { port: 3302, attempt: 2, maxAttempts: DEFAULT_PORT_ATTEMPTS }
    ]);
  });

  it('fails with a clear error once the bounded attempts are exhausted', async () => {
    let attempts = 0;

    await expect(
      runWithPortRetry({
        maxAttempts: 3,
        pickPort: () => 4400 + attempts,
        attempt: (port) => {
          attempts += 1;
          return Promise.reject(addrInUse(port));
        }
      })
    ).rejects.toThrow('no free port after 3 attempts');
    await expect(
      runWithPortRetry({
        maxAttempts: 3,
        pickPort: () => 4500,
        attempt: (port) => Promise.reject(addrInUse(port))
      })
    ).rejects.toThrow('last busy port 4500');
    expect(attempts).toBe(3);
  });

  it('propagates a non-EADDRINUSE failure immediately, without retrying', async () => {
    let attempts = 0;

    await expect(
      runWithPortRetry({
        pickPort: () => 4600,
        attempt: () => {
          attempts += 1;
          return Promise.reject(new Error('config dir unreadable'));
        }
      })
    ).rejects.toThrow('config dir unreadable');
    expect(attempts).toBe(1);
  });

  it('never moves a pinned port: a busy pin fails fast and names the port', async () => {
    let pickCalls = 0;

    await expect(
      runWithPortRetry({
        pinnedPort: 4777,
        pickPort: () => {
          pickCalls += 1;
          return 4700;
        },
        attempt: (port) => Promise.reject(addrInUse(port))
      })
    ).rejects.toThrow('pinned port 4777 is already in use');
    // The pinned contract forbids drawing a different port at all.
    expect(pickCalls).toBe(0);
  });

  it('recognises only EADDRINUSE-coded errors as port collisions', () => {
    expect(isAddrInUseError(addrInUse(3200))).toBe(true);
    expect(isAddrInUseError(new Error('boom'))).toBe(false);
    expect(isAddrInUseError(undefined)).toBe(false);
    expect(isAddrInUseError(null)).toBe(false);
  });
});
