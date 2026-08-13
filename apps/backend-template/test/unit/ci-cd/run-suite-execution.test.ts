/* eslint-disable @typescript-eslint/no-var-requires */
const {
  mapPinsToNode,
  runSuitePaths
} = require('../../../../../ci-cd/run-suite');

/**
 * How `run-suite` decides to spawn, and what it refuses (JUM-681).
 *
 * The resolution suite next to this one covers path validation and manifest
 * expansion. What was left uncovered is everything after that: which runtime is
 * chosen, what the child is actually given, and the exits that report failure
 * without running anything.
 *
 * These are not coverage-shaped tests. Each one is a way the runner can report
 * success over a run that did not happen — no paths, a rejected path, a pin
 * ignored, a spawn that returns no status — which is the false green
 * Requirement 065 exists to stop.
 */
const manifest = {
  suites: [
    { path: 'packages/sample/test/a.test.ts', runner: 'bun' },
    { path: 'packages/pinned/test/b.test.ts', runner: 'node', reason: 'needs jest module surgery' },
    { path: 'packages/pinned/test/c.test.ts', runner: 'node' }
  ]
};

const readTestMap = () => manifest;

describe('run-suite execution (JUM-681)', () => {
  it('refuses to report success when given no paths', () => {
    expect.hasAssertions();

    const spawn = jest.fn();

    expect(runSuitePaths([], { spawn })).toBe(1);
    expect(runSuitePaths(undefined, { spawn })).toBe(1);
    // Nothing ran, and the exit says so rather than "0 suites, all passed".
    expect(spawn).not.toHaveBeenCalled();
  });

  it('refuses a path that leaves the repository, without spawning', () => {
    expect.hasAssertions();

    const spawn = jest.fn();

    expect(runSuitePaths(['../outside/test'], { spawn, readTestMap })).toBe(1);
    expect(spawn).not.toHaveBeenCalled();
  });

  it('runs Bun with isolation, and passes the manifest paths rather than the request', () => {
    expect.hasAssertions();

    // `--isolate` is the difference between 25 tests running and 14 running with
    // one failure, so it is asserted rather than assumed.
    const spawn = jest.fn().mockReturnValue({ status: 0 });

    const status = runSuitePaths(['packages/sample/test'], {
      spawn,
      readTestMap,
      listTestFiles: () => ['packages/sample/test/a.test.ts'],
      runtime: 'bun'
    });

    expect(status).toBe(0);
    const [, args] = spawn.mock.calls[0];
    expect(args.slice(0, 2)).toStrictEqual(['test', '--isolate']);
    expect(args).toContain('packages/sample/test/a.test.ts');
  });

  it('runs Jest in band when the runtime resolves to node', () => {
    expect.hasAssertions();

    const spawn = jest.fn().mockReturnValue({ status: 0 });

    runSuitePaths(['packages/sample/test'], {
      spawn,
      readTestMap,
      listTestFiles: () => ['packages/sample/test/a.test.ts'],
      runtime: 'node',
      timeoutMs: 15_000
    });

    const [command, args, options] = spawn.mock.calls[0];
    expect(command).toBe('bun');
    expect(args.slice(0, 4)).toStrictEqual(['x', 'jest', '--runInBand', '--coverage=false']);
    expect(args).toContain('--testTimeout=15000');
    // Never through a shell: an argument array is only safe while it stays one.
    expect(options.shell).toBe(false);
  });

  it('lets a map pin override the resolved runtime', () => {
    expect.hasAssertions();

    // The pin exists because the suite cannot run under Bun at all, so
    // "prefer bun locally" is not a choice the environment gets to make.
    const spawn = jest.fn().mockReturnValue({ status: 0 });

    // `readTestMap` is injected for path resolution; the pin lookup has its own
    // seam, because it reads the manifest again through the module-level
    // default. Injecting one and not the other is how this test first passed
    // for the wrong reason — the pin was never consulted at all.
    runSuitePaths(['packages/pinned/test/b.test.ts'], {
      spawn,
      readTestMap,
      listTestFiles: () => ['packages/pinned/test/b.test.ts'],
      mapPinsToNode: (paths: string[]) => mapPinsToNode(paths, readTestMap),
      env: { JUMENTIX_TEST_RUNTIME: 'bun' }
    });

    expect(spawn.mock.calls[0][1]).toContain('jest');
  });

  it('treats a crashed spawn as a failure rather than a pass', () => {
    expect.hasAssertions();

    // `spawnSync` returns `status: null` when the child was killed by a signal.
    // Anything but an integer has to fail closed: a null read as success is a
    // green build over a run that was terminated.
    const killed = jest.fn().mockReturnValue({ status: null });

    expect(runSuitePaths(['packages/sample/test/a.test.ts'], {
      spawn: killed,
      readTestMap,
      listTestFiles: () => ['packages/sample/test/a.test.ts'],
      runtime: 'bun'
    })).toBe(1);

    expect(runSuitePaths(['packages/sample/test/a.test.ts'], {
      spawn: killed,
      readTestMap,
      listTestFiles: () => ['packages/sample/test/a.test.ts'],
      runtime: 'node'
    })).toBe(1);
  });

  it('only honours a pin that declares its reason', () => {
    expect.hasAssertions();

    // Requirement 110: `runner: "node"` without a reason is an undeclared
    // exception, and an undeclared exception is not one.
    expect(mapPinsToNode(['packages/pinned/test/b.test.ts'], readTestMap)).toBe(true);
    expect(mapPinsToNode(['packages/pinned/test/c.test.ts'], readTestMap)).toBe(false);
    expect(mapPinsToNode(['packages/sample/test/a.test.ts'], readTestMap)).toBe(false);
    // A directory request pins when any suite beneath it is pinned.
    expect(mapPinsToNode(['packages/pinned/test'], readTestMap)).toBe(true);
  });

  it('falls back to the caller when there is no map to read', () => {
    expect.hasAssertions();

    // No map, no pin — and no crash: the runtime resolution the caller already
    // has still stands.
    expect(mapPinsToNode(['packages/sample/test/a.test.ts'], () => {
      throw new Error('test-map.json is missing');
    })).toBe(false);
  });
});
