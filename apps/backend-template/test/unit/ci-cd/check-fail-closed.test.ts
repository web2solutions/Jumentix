/* eslint-disable @typescript-eslint/no-var-requires */
const { resolveBunBinary, summarize } = require('../../../../../ci-cd/check-fail-closed');

describe('check-fail-closed', () => {
  it('resolves the interpreter to the running binary when under Bun', () => {
    expect.hasAssertions();
    // Pinning the interpreter is the point of Requirement 096 §1: a PATH lookup
    // could run a different Bun than the one executing the harness.
    expect(resolveBunBinary({ bun: '1.3.13' } as never, '/usr/local/bin/bun')).toBe('/usr/local/bin/bun');
  });

  it('refuses to run under Node, where execPath would be the wrong runtime', () => {
    expect.hasAssertions();
    // Without this the harness would report eight passes while exercising Node —
    // a false green inside the harness that exists to prevent them.
    expect(() => resolveBunBinary({ node: '22.23.1' } as never, '/usr/bin/node'))
      .toThrow('must run under Bun');
  });

  it('treats every gate class failing closed as the only acceptable verdict', () => {
    expect.hasAssertions();
    const verdict = summarize([
      { name: 'a', passed: true, status: 1 },
      { name: 'b', passed: true, status: 2 }
    ]);

    expect(verdict).toStrictEqual({ total: 2, failed: [], ok: true });
  });

  it('reports a gate that passed with a fault injected, which is a false green', () => {
    expect.hasAssertions();
    const verdict = summarize([
      { name: 'guard', passed: true, status: 1 },
      { name: 'leaky gate', passed: false, status: 0 }
    ]);

    expect(verdict.ok).toBe(false);
    expect(verdict.total).toBe(2);
    expect(verdict.failed).toHaveLength(1);
    expect(verdict.failed[0].name).toBe('leaky gate');
  });

  it('counts a signal or timeout as not failing closed, since the exit is unknown', () => {
    expect.hasAssertions();
    const verdict = summarize([{ name: 'timed out', passed: false, status: null }]);

    expect(verdict.ok).toBe(false);
    expect(verdict.failed[0].status).toBeNull();
  });

  it('treats an empty run as vacuously ok, which is why the CLI asserts the count', () => {
    expect.hasAssertions();
    // Documents a real limitation: summarize alone cannot tell "all passed" from
    // "nothing ran". The CLI prints the total so a zero is visible in the log.
    expect(summarize([])).toStrictEqual({ total: 0, failed: [], ok: true });
  });
});
