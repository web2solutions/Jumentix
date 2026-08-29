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

/**
 * Path resolution against the map (JUM-681).
 *
 * `resolveMappedSuitePaths` is what turns a requested directory into the suite
 * paths that actually execute. Its two rejections are the false greens
 * Requirement 065 names: a request matching nothing would run zero tests and
 * report success, and a file on disk that the map does not list would sit in a
 * directory reported as fully run.
 */
describe('run-suite path resolution (JUM-681)', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const suiteModule = require('../../../../../ci-cd/run-suite') as {
    canonicalSuitePaths: (paths: string[], root?: string) => string[];
    resolveMappedSuitePaths: (paths: string[], options?: Record<string, unknown>) => {
      resolved: string[]; unmatched: string[]; unmapped: string[];
    };
  };

  const root = '/repo';
  const readResolutionMap = () => ({
    suites: [
      { path: 'packages/sample/test/a.test.ts' },
      { path: 'packages/sample/test/b.test.ts' }
    ]
  });

  it('canonicalises a request rather than executing the string it was given', () => {
    expect.hasAssertions();

    // The executed value is derived from the validated one, so `./a/../b`
    // shapes cannot smuggle a different path past the check.
    expect(suiteModule.canonicalSuitePaths(['packages/./sample/../sample/test'], root))
      .toStrictEqual(['packages/sample/test']);
  });

  it('expands a directory to every mapped suite beneath it', () => {
    expect.hasAssertions();

    const result = suiteModule.resolveMappedSuitePaths(['packages/sample/test'], {
      root,
      readTestMap: readResolutionMap,
      listTestFiles: () => ['packages/sample/test/a.test.ts', 'packages/sample/test/b.test.ts']
    });

    expect(result.resolved).toStrictEqual([
      'packages/sample/test/a.test.ts',
      'packages/sample/test/b.test.ts'
    ]);
    expect(result.unmatched).toStrictEqual([]);
    expect(result.unmapped).toStrictEqual([]);
  });

  it('reports a request that matches nothing instead of running zero tests', () => {
    expect.hasAssertions();

    const result = suiteModule.resolveMappedSuitePaths(['packages/sample/tes'], {
      root,
      readTestMap: readResolutionMap,
      listTestFiles: () => []
    });

    expect(result.resolved).toStrictEqual([]);
    expect(result.unmatched).toStrictEqual(['packages/sample/tes']);
  });

  it('reports a file on disk that the map does not list', () => {
    expect.hasAssertions();

    // The directory reports as fully run while one of its suites is invisible
    // to the selector — the shape JUM-680 found across the website.
    const result = suiteModule.resolveMappedSuitePaths(['packages/sample/test'], {
      root,
      readTestMap: readResolutionMap,
      listTestFiles: () => [
        'packages/sample/test/a.test.ts',
        'packages/sample/test/unmapped.test.ts'
      ]
    });

    expect(result.unmapped).toStrictEqual(['packages/sample/test/unmapped.test.ts']);
  });
});

/**
 * The manifest shapes and the child environment (JUM-721).
 *
 * A `test-map.json` without a `suites` key is not a hypothetical: it is what a
 * half-written map, or one being regenerated, looks like on disk. Reading it as
 * "no suites" rather than crashing is what keeps the runner reporting a
 * resolution failure the caller can act on instead of a TypeError from inside
 * the loader.
 *
 * The child environment is the other half: a cell that asks for a runtime, a
 * skip list or a broker flag passes it through `options.env`, and a runner that
 * dropped it would run a different configuration and report the exit status of
 * the run it did do.
 */
describe('run-suite manifest and environment (JUM-721)', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const runner = require('../../../../../ci-cd/run-suite') as {
    resolveMappedSuitePaths: (paths: string[], options?: Record<string, unknown>) => {
      resolved: string[]; unmatched: string[]; unmapped: string[];
    };
  };
  const emptyMap = () => ({});

  it('reads a manifest with no suites key as no suites at all', () => {
    expect.hasAssertions();

    const resolved = runner.resolveMappedSuitePaths(['packages/sample/test'], {
      root: '/repo',
      readTestMap: emptyMap,
      listTestFiles: () => []
    });

    expect(resolved.resolved).toStrictEqual([]);
    expect(resolved.unmatched).toStrictEqual(['packages/sample/test']);
    expect(mapPinsToNode(['packages/sample/test'], emptyMap)).toBe(false);
  });

  it('passes the caller environment to the child on both runtimes', () => {
    expect.hasAssertions();

    const bun = jest.fn().mockReturnValue({ status: 0 });
    const node = jest.fn().mockReturnValue({ status: 0 });
    const options = {
      readTestMap,
      listTestFiles: () => ['packages/sample/test/a.test.ts'],
      env: { RUN_BROKER_INTEGRATION: '1' }
    };

    runSuitePaths(['packages/sample/test'], { ...options, spawn: bun, runtime: 'bun' });
    runSuitePaths(['packages/sample/test'], { ...options, spawn: node, runtime: 'node' });

    expect(bun.mock.calls[0][2].env).toMatchObject({ RUN_BROKER_INTEGRATION: '1' });
    expect(node.mock.calls[0][2].env).toMatchObject({ RUN_BROKER_INTEGRATION: '1' });
  });

  it('gives the child a NODE_ENV even when the parent has none', () => {
    expect.hasAssertions();

    // The suites read `NODE_ENV` to decide error exposure and seeding. A child
    // that inherited nothing would run in whatever the framework defaults to,
    // which is not the same thing on every framework.
    const spawn = jest.fn().mockReturnValue({ status: 0 });
    const mutableEnv = process.env as Record<string, string | undefined>;
    const previous = mutableEnv.NODE_ENV;
    delete mutableEnv.NODE_ENV;

    runSuitePaths(['packages/sample/test'], {
      spawn,
      readTestMap,
      listTestFiles: () => ['packages/sample/test/a.test.ts'],
      runtime: 'bun'
    });

    mutableEnv.NODE_ENV = previous;

    expect(spawn.mock.calls[0][2].env.NODE_ENV).toBe('dev');
  });
});
