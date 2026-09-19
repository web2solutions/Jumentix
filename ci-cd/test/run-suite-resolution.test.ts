/* eslint-disable @typescript-eslint/no-var-requires */
import path from 'node:path';

/**
 * Suite paths are resolved through test-map.json, and git is resolved by
 * absolute path.
 *
 * Both are security fixes with a correctness half, and the correctness half is
 * what these tests hold down. Sonar reported the previous shapes as
 * `jssecurity:S8705` (command-line arguments reaching a spawned process) and
 * `javascript:S4036` (an executable resolved through PATH). Neither was
 * suppressed: the argument values now originate in the manifest rather than in
 * `process.argv`, and git is located in a fixed system directory.
 *
 * The behaviour that came with the first fix matters on its own. A path that
 * matches nothing used to run zero suites and report success.
 */

const repoRoot = path.resolve(__dirname, '../..');
const {
  defaultListTestFiles,
  invalidSuitePaths,
  mapPinsToNode,
  parseArgs,
  resolveMappedSuitePaths,
  runAsEntryPoint,
  runSuitePaths
} = require(path.join(repoRoot, 'ci-cd', 'run-suite.js'));
const { resolveGitBinary } = require(path.join(repoRoot, 'ci-cd', 'lib', 'git-binary.js'));

/** A manifest with the given suite paths. */
function mapWith(paths: string[]) {
  return () => ({ suites: paths.map((suitePath) => ({ path: suitePath })) });
}

/** A disk listing that reports exactly the given files, whatever is asked. */
function diskWith(files: string[]) {
  return () => files;
}

describe('resolveMappedSuitePaths', () => {
  const suites = [
    'apps/backend-template/test/integration/Express/a.test.ts',
    'apps/backend-template/test/integration/Express/b.test.ts',
    'apps/backend-template/test/integration/Fastify/c.test.ts'
  ];

  it('expands a directory to every mapped suite beneath it', () => {
    expect.hasAssertions();

    const result = resolveMappedSuitePaths(['apps/backend-template/test/integration/Express'], {
      readTestMap: mapWith(suites),
      listTestFiles: diskWith(suites.slice(0, 2))
    });

    expect(result.resolved).toStrictEqual(suites.slice(0, 2));
    expect(result.unmatched).toStrictEqual([]);
    expect(result.unmapped).toStrictEqual([]);
  });

  it('resolves an exact suite path to itself', () => {
    expect.hasAssertions();

    const result = resolveMappedSuitePaths([suites[2]], {
      readTestMap: mapWith(suites),
      listTestFiles: diskWith([suites[2]])
    });

    expect(result.resolved).toStrictEqual([suites[2]]);
  });

  /**
   * The values handed to the spawn come from the manifest, not from the request.
   * This is what removes the taint flow rather than annotating it, so it is
   * asserted on identity and not merely on equality of text.
   */
  it('returns manifest entries, never the requested string', () => {
    expect.hasAssertions();

    const manifest = { suites: suites.map((suitePath) => ({ path: suitePath })) };
    const result = resolveMappedSuitePaths(['apps/backend-template/test/integration/Express'], {
      readTestMap: () => manifest,
      listTestFiles: diskWith(suites.slice(0, 2))
    });

    for (const resolved of result.resolved) {
      expect(manifest.suites.some((suite) => suite.path === resolved)).toBe(true);
    }
  });

  /**
   * The regression that motivated the loud failure: a mistyped directory matched
   * nothing, the runner was handed no paths, and reported success.
   */
  it('reports a path that matches no mapped suite', () => {
    expect.hasAssertions();

    const result = resolveMappedSuitePaths(['apps/backend-template/test/integration/Expres'], {
      readTestMap: mapWith(suites),
      listTestFiles: diskWith([])
    });

    expect(result.resolved).toStrictEqual([]);
    expect(result.unmatched).toStrictEqual(['apps/backend-template/test/integration/Expres']);
  });

  /**
   * A suite on disk but absent from the map would be skipped while its whole
   * directory reported as run — a false green under Requirement 065.
   */
  it('reports test files present on disk but missing from the map', () => {
    expect.hasAssertions();

    const result = resolveMappedSuitePaths(['apps/backend-template/test/integration/Express'], {
      readTestMap: mapWith(suites),
      listTestFiles: diskWith([
        ...suites.slice(0, 2),
        'apps/backend-template/test/integration/Express/unregistered.test.ts'
      ])
    });

    expect(result.unmapped).toStrictEqual([
      'apps/backend-template/test/integration/Express/unregistered.test.ts'
    ]);
  });

  it('does not run a suite twice when two requests overlap', () => {
    expect.hasAssertions();

    const result = resolveMappedSuitePaths([
      'apps/backend-template/test/integration/Express',
      suites[0]
    ], {
      readTestMap: mapWith(suites),
      listTestFiles: diskWith(suites.slice(0, 2))
    });

    expect(result.resolved).toStrictEqual(suites.slice(0, 2));
  });

  /**
   * A prefix must stop at a path separator. Without that, requesting `.../Express`
   * would also pull in a sibling directory named `Express-legacy`.
   */
  it('does not treat a sibling with a shared prefix as a match', () => {
    expect.hasAssertions();

    const withSibling = [
      'apps/backend-template/test/integration/Express/a.test.ts',
      'apps/backend-template/test/integration/Express-legacy/z.test.ts'
    ];

    const result = resolveMappedSuitePaths(['apps/backend-template/test/integration/Express'], {
      readTestMap: mapWith(withSibling),
      listTestFiles: diskWith([withSibling[0]])
    });

    expect(result.resolved).toStrictEqual([withSibling[0]]);
  });
});

describe('parseArgs', () => {
  it('separates paths from the label and timeout flags', () => {
    expect.hasAssertions();

    const parsed = parseArgs([
      'bun', 'run-suite.js', '--script-label', 'express', '--timeout', '15000', 'a/b', 'c/d'
    ]);

    expect(parsed).toStrictEqual({ paths: ['a/b', 'c/d'], label: 'express', timeoutMs: 15000 });
  });
});

describe('invalidSuitePaths', () => {
  it.each([
    ['a shell metacharacter', 'apps/test; rm -rf /'],
    ['an absolute path', '/etc/passwd'],
    ['an escape from the repository', '../../elsewhere'],
    ['an empty string', '']
  ])('rejects %s', (_label, given) => {
    expect.hasAssertions();

    expect(invalidSuitePaths([given], '/repo')).toStrictEqual([given]);
  });

  it('accepts a plain repository-relative path', () => {
    expect.hasAssertions();

    expect(invalidSuitePaths(['apps/backend-template/test/integration/Express'], '/repo'))
      .toStrictEqual([]);
  });
});

describe('mapPinsToNode', () => {
  const pinned = {
    suites: [{
      path: 'apps/backend-template/test/integration/Restify/a.test.ts',
      runner: 'node',
      reason: 'restify cannot load under bun'
    }]
  };

  it('reports a pin covering the requested directory', () => {
    expect.hasAssertions();

    expect(mapPinsToNode(['apps/backend-template/test/integration/Restify'], () => pinned))
      .toBe(true);
  });

  /**
   * `runner: "node"` without a stated reason is not an exception, it is a
   * preference — Requirement 110 requires the reason, and honouring the pin
   * without it would let any suite quietly opt out of the declared runner.
   */
  it('ignores a node pin that states no reason', () => {
    expect.hasAssertions();

    const unreasoned = { suites: [{ ...pinned.suites[0], reason: undefined }] };

    expect(mapPinsToNode(['apps/backend-template/test/integration/Restify'], () => unreasoned))
      .toBe(false);
  });

  it('does not pin an unrelated path', () => {
    expect.hasAssertions();

    expect(mapPinsToNode(['apps/backend-template/test/integration/Express'], () => pinned))
      .toBe(false);
  });

  it('falls back to no pin when the map cannot be read', () => {
    expect.hasAssertions();

    expect(mapPinsToNode(['anything'], () => { throw new Error('no map'); })).toBe(false);
  });
});

describe('runSuitePaths', () => {
  const suites = ['apps/backend-template/test/integration/Express/a.test.ts'];

  /** Records the spawn instead of performing it. */
  function recordingSpawn(status = 0) {
    const calls: Array<{ command: string; args: string[] }> = [];
    const spawn = (command: string, args: string[]) => {
      calls.push({ command, args });
      return { status };
    };
    return { spawn, calls };
  }

  const withMap = (overrides = {}) => ({
    resolveMappedSuitePaths: () => ({ resolved: suites, unmatched: [], unmapped: [] }),
    mapPinsToNode: () => false,
    ...overrides
  });

  /**
   * The fix this locks down: bun reuses one process across files unless told
   * otherwise, and the three Lambda suites sharing a module registry meant
   * eleven tests never ran while the output read "13 pass, 1 fail". Nothing
   * except this assertion states that the flag must be there.
   */
  it('passes --isolate when running under bun', () => {
    expect.hasAssertions();

    const { spawn, calls } = recordingSpawn();
    runSuitePaths(suites, withMap({ spawn, runtime: 'bun' }));

    expect(calls).toHaveLength(1);
    expect(calls[0].args[0]).toBe('test');
    expect(calls[0].args).toContain('--isolate');
    expect(calls[0].args).toStrictEqual(expect.arrayContaining(suites));
  });

  it('runs jest in band when the runtime is node', () => {
    expect.hasAssertions();

    const { spawn, calls } = recordingSpawn();
    runSuitePaths(suites, withMap({ spawn, runtime: 'node', timeoutMs: 15000 }));

    expect(calls[0].command).toBe('bun');
    expect(calls[0].args).toStrictEqual(
      expect.arrayContaining(['x', 'jest', '--runInBand', '--coverage=false', '--testTimeout=15000'])
    );
  });

  /**
   * A map pin exists because the suite cannot load under bun at all, so
   * "prefer bun locally" is not a choice the environment gets to make.
   */
  it('lets a map pin override the resolved runtime', () => {
    expect.hasAssertions();

    const { spawn, calls } = recordingSpawn();
    runSuitePaths(suites, withMap({ spawn, mapPinsToNode: () => true }));

    expect(calls[0].command).toBe('bun');
    expect(calls[0].args.slice(0, 2)).toStrictEqual(['x', 'jest']);
  });

  it('returns the spawned status', () => {
    expect.hasAssertions();

    const { spawn } = recordingSpawn(3);

    expect(runSuitePaths(suites, withMap({ spawn, runtime: 'bun' }))).toBe(3);
  });

  /** A signal leaves `status` null; treating that as success would be a false green. */
  it('fails when the spawn reports no exit status', () => {
    expect.hasAssertions();

    const spawn = () => ({ status: null });

    expect(runSuitePaths(suites, withMap({ spawn, runtime: 'bun' }))).toBe(1);
  });

  it.each([
    ['no paths at all', [], {}],
    ['a path outside the repository', ['/etc/passwd'], {}],
    ['a path matching no mapped suite', ['apps/nope'], {
      resolveMappedSuitePaths: () => ({ resolved: [], unmatched: ['apps/nope'], unmapped: [] })
    }],
    ['a suite on disk that the map omits', ['apps/x'], {
      resolveMappedSuitePaths: () => ({
        resolved: ['apps/x/a.test.ts'], unmatched: [], unmapped: ['apps/x/b.test.ts']
      })
    }]
  ])('refuses to run and spawns nothing for %s', (_label, paths, overrides) => {
    expect.hasAssertions();

    const { spawn, calls } = recordingSpawn();

    expect(runSuitePaths(paths, withMap({ spawn, runtime: 'bun', ...overrides }))).toBe(1);
    expect(calls).toStrictEqual([]);
  });
});

describe('defaultListTestFiles', () => {
  const root = repoRoot;

  it('lists every test file beneath a directory', () => {
    expect.hasAssertions();

    const listed = defaultListTestFiles(
      path.join(root, 'apps/backend-template/test/integration/Lambda'),
      root
    );

    expect(listed.length).toBeGreaterThan(1);
    expect(listed.every((file: string) => file.endsWith('.test.ts'))).toBe(true);
  });

  it('returns a single entry for a file given directly', () => {
    expect.hasAssertions();

    const single = 'apps/backend-template/test/integration/Lambda/get.localhost.test.ts';

    expect(defaultListTestFiles(path.join(root, single), root)).toStrictEqual([single]);
  });

  it('ignores a file that is not a test', () => {
    expect.hasAssertions();

    expect(defaultListTestFiles(path.join(root, 'package.json'), root)).toStrictEqual([]);
  });

  it('returns nothing for a path that does not exist', () => {
    expect.hasAssertions();

    expect(defaultListTestFiles(path.join(root, 'no/such/place'), root)).toStrictEqual([]);
  });
});

/**
 * The wiring between the parsed flags and the runner. Inline in an
 * `if (isEntryPoint(module))` block it cannot be reached from a suite, so a flag
 * connected to the wrong option would go unnoticed.
 */
describe('runAsEntryPoint', () => {
  it('does nothing when the module is merely imported', () => {
    expect.hasAssertions();

    const runs: unknown[] = [];
    const ran = runAsEntryPoint({
      caller: { id: 'imported' },
      entry: { id: 'something-else' },
      run: (...args: unknown[]) => { runs.push(args); return 0; }
    });

    expect(ran).toBe(false);
    expect(runs).toStrictEqual([]);
  });

  it('passes the parsed paths, label and timeout through to the runner', () => {
    expect.hasAssertions();

    const entry = { id: 'the-entry-point' };
    const exits: number[] = [];
    let received: unknown;

    const ran = runAsEntryPoint({
      caller: entry,
      entry,
      argv: ['bun', 'run-suite.js', '--script-label', 'restify', '--timeout', '15000', 'a/b'],
      exit: (code: number) => exits.push(code),
      run: (paths: string[], options: Record<string, unknown>) => {
        received = { paths, options };
        return 7;
      }
    });

    expect(ran).toBe(true);
    expect(received).toStrictEqual({
      paths: ['a/b'],
      options: { label: 'restify', timeoutMs: 15000 }
    });
    // The runner's status becomes the process exit code, unchanged.
    expect(exits).toStrictEqual([7]);
  });
});

describe('resolveGitBinary', () => {
  it('returns the first candidate that exists', () => {
    expect.hasAssertions();

    const resolved = resolveGitBinary(
      ['/nowhere/git', '/usr/bin/git'],
      (candidate: string) => candidate === '/usr/bin/git'
    );

    expect(resolved).toBe('/usr/bin/git');
  });

  /**
   * Fails closed rather than falling back to a PATH lookup: a checker that
   * cannot tell which binary it is about to run should stop.
   */
  it('throws rather than falling back to PATH when no candidate exists', () => {
    expect.hasAssertions();

    expect(() => resolveGitBinary(['/nowhere/git'], () => false))
      .toThrow('Could not find git in a fixed system location');
  });

  it('resolves on this machine', () => {
    expect.hasAssertions();

    expect(path.isAbsolute(resolveGitBinary())).toBe(true);
  });
});
