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

const repoRoot = path.resolve(__dirname, '../../../../..');
const { resolveMappedSuitePaths } = require(path.join(repoRoot, 'ci-cd', 'run-suite.js'));
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
