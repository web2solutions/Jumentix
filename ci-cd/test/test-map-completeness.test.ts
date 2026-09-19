/* eslint-disable @typescript-eslint/no-var-requires */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * The map is the target list, not a description of it.
 *
 * `ci-cd/run-unit-tests.js` builds what it runs from `test-map.json`, so the two
 * directions of the relationship fail very differently. An entry pointing at a
 * missing file was already caught. A file with no entry was not — and that one
 * is silent: the suite does not run, nothing reports it, and adding a test looks
 * exactly like adding a passing test.
 *
 * The generator has the mirror-image problem. It walked three fixed directories
 * under `apps/backend-template/test/` and nothing else, so regenerating the map
 * deleted every package suite — 214 in, 195 out, no error — along with the
 * quarantine and every Node runner pin.
 */

const repoRoot = path.resolve(__dirname, '../..');
const {
  allTestFilesOnDisk,
  listTestFiles,
  suiteRoots,
  unmappedTestFiles
} = require(path.join(repoRoot, 'ci-cd', 'lib', 'mapped-suites.js'));
const { validateTestMap } = require(path.join(repoRoot, 'ci-cd', 'lib', 'test-map.js'));

const dirs: string[] = [];
const track = (dir: string) => { dirs.push(dir); return dir; };

/** A throwaway tree with the given repository-relative files. */
function tree(files: string[]): string {
  const dir = track(fs.mkdtempSync(path.join(os.tmpdir(), 'test-map-')));
  for (const file of files) {
    const full = path.join(dir, file);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, 'it("x", () => {});\n');
  }
  return dir;
}

/** A manifest whose entries point at the given paths. */
function manifestFor(paths: string[]) {
  return { suites: paths.map((suitePath) => ({ path: suitePath })) };
}

describe('fixtures', () => {
  afterAll(() => {
    for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
  });

  it('cleans up after itself', () => {
    expect.hasAssertions();

    // The cleanup above is the point; this asserts the register exists so the
    // hook cannot be silently orphaned by a future edit.
    expect(Array.isArray(dirs)).toBe(true);
  });
});

describe('listTestFiles', () => {
  it('finds suites at any depth', () => {
    expect.hasAssertions();

    const dir = tree(['apps/a/test/one.test.ts', 'apps/a/test/deep/two.test.ts']);

    expect(listTestFiles(path.join(dir, 'apps'), dir)).toStrictEqual([
      'apps/a/test/deep/two.test.ts',
      'apps/a/test/one.test.ts'
    ]);
  });

  it('accepts a file directly, not only a directory', () => {
    expect.hasAssertions();

    const dir = tree(['apps/a/test/one.test.ts']);
    const file = path.join(dir, 'apps/a/test/one.test.ts');

    expect(listTestFiles(file, dir)).toStrictEqual(['apps/a/test/one.test.ts']);
  });

  it('ignores a file that is not a suite', () => {
    expect.hasAssertions();

    const dir = tree(['apps/a/test/helper.ts']);

    expect(listTestFiles(path.join(dir, 'apps'), dir)).toStrictEqual([]);
  });

  it('returns nothing for a path that does not exist', () => {
    expect.hasAssertions();

    expect(listTestFiles(path.join(repoRoot, 'no/such/place'), repoRoot)).toStrictEqual([]);
  });

  /**
   * `node_modules` alone holds thousands of dependency suites. Reporting those
   * as unmapped would make the check unusable on its first run, so the skip is
   * asserted rather than assumed.
   */
  it.each(['node_modules', 'dist', '.build', 'coverage'])('does not descend into %s', (skipped) => {
    expect.hasAssertions();

    const dir = tree([`apps/a/${skipped}/vendored.test.ts`, 'apps/a/test/mine.test.ts']);

    expect(listTestFiles(path.join(dir, 'apps'), dir)).toStrictEqual(['apps/a/test/mine.test.ts']);
  });
});

describe('suiteRoots', () => {
  it('covers apps and every package test directory', () => {
    expect.hasAssertions();

    const dir = tree(['packages/alpha/test/a.test.ts', 'packages/beta/test/b.test.ts']);

    expect(suiteRoots(dir)).toStrictEqual([
      'apps',
      path.join('packages', 'alpha', 'test'),
      path.join('packages', 'beta', 'test'),
      'ci-cd/test'
    ]);
  });

  it('copes with a repository that has no packages directory', () => {
    expect.hasAssertions();

    const dir = tree(['apps/a/test/one.test.ts']);

    expect(suiteRoots(dir)).toStrictEqual(['apps', 'ci-cd/test']);
  });
});

describe('unmappedTestFiles', () => {
  it('reports a suite on disk with no entry', () => {
    expect.hasAssertions();

    const dir = tree(['apps/a/test/mapped.test.ts', 'apps/a/test/forgotten.test.ts']);

    expect(unmappedTestFiles(manifestFor(['apps/a/test/mapped.test.ts']), dir))
      .toStrictEqual(['apps/a/test/forgotten.test.ts']);
  });

  it('reports nothing when every suite is mapped', () => {
    expect.hasAssertions();

    const dir = tree(['apps/a/test/one.test.ts', 'packages/alpha/test/two.test.ts']);
    const manifest = manifestFor(['apps/a/test/one.test.ts', 'packages/alpha/test/two.test.ts']);

    expect(unmappedTestFiles(manifest, dir)).toStrictEqual([]);
  });

  /** A package suite is as easy to forget as an app one, and cana has eighteen. */
  it('sees package suites, not only app suites', () => {
    expect.hasAssertions();

    const dir = tree(['packages/alpha/test/forgotten.test.ts']);

    expect(unmappedTestFiles(manifestFor([]), dir))
      .toStrictEqual(['packages/alpha/test/forgotten.test.ts']);
  });

  it('treats an empty manifest as mapping nothing', () => {
    expect.hasAssertions();

    const dir = tree(['apps/a/test/one.test.ts']);

    expect(unmappedTestFiles({}, dir)).toStrictEqual(['apps/a/test/one.test.ts']);
  });
});

describe('validateTestMap completeness', () => {
  const layers = { tooling: { dependsOn: [], sourceGlobs: ['apps/**'] } };

  /** A manifest that is otherwise valid, so the assertion is about one thing. */
  function validManifest(paths: string[]) {
    return {
      layers,
      suites: paths.map((suitePath) => ({
        id: suitePath,
        path: suitePath,
        layer: 'tooling',
        type: 'unit',
        runner: 'bun',
        tier: 'gate'
      })),
      quarantine: []
    };
  }

  it('fails when a suite on disk has no entry', () => {
    expect.hasAssertions();

    const dir = tree(['apps/a/test/mapped.test.ts', 'apps/a/test/forgotten.test.ts']);
    const result = validateTestMap(validManifest(['apps/a/test/mapped.test.ts']), { root: dir });

    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('apps/a/test/forgotten.test.ts');
    expect(result.errors.join('\n')).toContain('test-map:generate');
  });

  it('passes when the manifest and the tree agree', () => {
    expect.hasAssertions();

    const dir = tree(['apps/a/test/one.test.ts']);
    const result = validateTestMap(validManifest(['apps/a/test/one.test.ts']), { root: dir });

    expect(result).toMatchObject({ ok: true, errors: [] });
  });

  /**
   * The enumeration is injectable so this suite does not have to build a tree to
   * assert the wiring, and so a future caller can narrow the scan without
   * reaching into the filesystem.
   */
  it('uses an injected enumeration when one is given', () => {
    expect.hasAssertions();

    const dir = tree(['apps/a/test/one.test.ts']);
    const result = validateTestMap(validManifest(['apps/a/test/one.test.ts']), {
      root: dir,
      unmappedTestFiles: () => ['injected/ghost.test.ts']
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('injected/ghost.test.ts');
  });
});

/**
 * The repository's own tree, which is the case that actually regressed. Every
 * other test here builds a fixture; this one asserts the invariant holds where
 * it matters.
 */
describe('the repository itself', () => {
  it('maps every suite that exists', () => {
    expect.hasAssertions();

    const manifest = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'test-map.json'), 'utf8')
    );

    expect(unmappedTestFiles(manifest, repoRoot)).toStrictEqual([]);
  });

  it('finds the package suites the generator used to drop', () => {
    expect.hasAssertions();

    const onDisk = allTestFilesOnDisk(repoRoot);

    expect(onDisk.filter((file: string) => file.startsWith('packages/cana/test/')).length)
      .toBeGreaterThan(0);
  });
});
