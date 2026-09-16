/* eslint-disable @typescript-eslint/no-var-requires */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Requirement 112 — every package owns its own suite.
 *
 * The register of packages that do not yet have one is the part worth testing.
 * A register that only ever grows is not a plan, it is a list of excuses, so the
 * check has to fail in both directions: on an undeclared package with no suite,
 * and on a declared package that has since grown one. The second is the case
 * nobody thinks to write, and it is the one that keeps the list honest.
 */

const repoRoot = path.resolve(__dirname, '../../../../..');
const {
  main,
  readSonarExclusions,
  run,
  runAsEntryPoint
} = require(path.join(repoRoot, 'ci-cd', 'check-package-suites.js'));

/** A throwaway workspace with the given packages. */
function workspace(packages: Record<string, { source?: boolean; suite?: boolean }>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkg-suites-'));

  for (const [name, shape] of Object.entries(packages)) {
    const pkg = path.join(dir, 'packages', name);
    if (shape.source !== false) {
      fs.mkdirSync(path.join(pkg, 'src'), { recursive: true });
      fs.writeFileSync(path.join(pkg, 'src', 'index.ts'), 'export const a = 1;\n');
    } else {
      fs.mkdirSync(pkg, { recursive: true });
    }
    if (shape.suite) {
      fs.mkdirSync(path.join(pkg, 'test'), { recursive: true });
      fs.writeFileSync(path.join(pkg, 'test', 'a.test.ts'), 'it("x", () => {});\n');
    }
  }

  return dir;
}

/** A sonar config excluding exactly the named packages. */
function sonarConfig(excluded: string[]): string {
  const entries = ['ci-cd/check-fail-closed.js', ...excluded.map((n) => `packages/${n}/**`)];
  return `sonar.coverage.exclusions=\\\n  ${entries.join(',\\\n  ')}\n`;
}

function check(dir: string, register: Record<string, unknown>, excluded: string[]) {
  return run({
    root: dir,
    register,
    readFile: () => sonarConfig(excluded)
  });
}

const declared = {
  since: '2026-08-01',
  issue: 'JUM-585',
  reason: 'needs driver fakes'
};

describe('check-package-suites', () => {
  const dirs: string[] = [];
  const track = (dir: string) => { dirs.push(dir); return dir; };

  afterAll(() => {
    for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
  });

  it('passes when every package with source owns a suite', () => {
    expect.hasAssertions();

    const dir = track(workspace({ alpha: { suite: true }, beta: { suite: true } }));

    expect(check(dir, {}, []).ok).toBe(true);
  });

  it('fails on a package with source, no suite, and no declaration', () => {
    expect.hasAssertions();

    const dir = track(workspace({ alpha: {} }));
    const result = check(dir, {}, []);

    expect(result.ok).toBe(false);
    expect(result.message).toContain('alpha');
    expect(result.message).toContain('no test suite of its own');
  });

  it('accepts a declared package that still has no suite', () => {
    expect.hasAssertions();

    const dir = track(workspace({ alpha: {} }));

    expect(check(dir, { alpha: declared }, ['alpha']).ok).toBe(true);
  });

  /**
   * The ratchet. Without it the register never shrinks and stops describing
   * anything — the failure mode of every "temporary" exemption list.
   */
  it('fails when a declared package has since grown a suite', () => {
    expect.hasAssertions();

    const dir = track(workspace({ alpha: { suite: true } }));
    const result = check(dir, { alpha: declared }, ['alpha']);

    expect(result.ok).toBe(false);
    expect(result.message).toContain('still declared in WITHOUT_SUITE_YET');
  });

  it.each([
    ['no since date', { issue: 'JUM-585', reason: 'x' }, 'valid ISO `since`'],
    ['a malformed since date', { since: '01/08/2026', issue: 'JUM-585', reason: 'x' }, 'valid ISO `since`'],
    ['no issue', { since: '2026-08-01', reason: 'x' }, 'tracking `issue`'],
    ['no reason', { since: '2026-08-01', issue: 'JUM-585' }, '`reason`']
  ])('fails on a declaration with %s', (_label, entry, expected) => {
    expect.hasAssertions();

    const dir = track(workspace({ alpha: {} }));
    const result = check(dir, { alpha: entry }, ['alpha']);

    expect(result.ok).toBe(false);
    expect(result.message).toContain(expected);
  });

  /**
   * The two lists have to agree. A package declared here but visible to Sonar
   * fails the quality gate for a gap already recorded; a package excluded from
   * Sonar but not declared here is hidden with nothing recording why.
   */
  it('fails when a declared package is not excluded from Sonar coverage', () => {
    expect.hasAssertions();

    const dir = track(workspace({ alpha: {} }));
    const result = check(dir, { alpha: declared }, []);

    expect(result.ok).toBe(false);
    expect(result.message).toContain('not in sonar.coverage.exclusions');
  });

  it('fails when Sonar excludes a package that is not declared', () => {
    expect.hasAssertions();

    const dir = track(workspace({ alpha: { suite: true } }));
    const result = check(dir, {}, ['alpha']);

    expect(result.ok).toBe(false);
    expect(result.message).toContain('excluded from Sonar coverage but is not declared');
  });

  /** A package of pure configuration has nothing to test and is not owed a suite. */
  it('ignores a package with no source of its own', () => {
    expect.hasAssertions();

    const dir = track(workspace({ 'config-only': { source: false } }));

    expect(check(dir, {}, []).ok).toBe(true);
  });

  it('fails closed when the Sonar configuration cannot be read', () => {
    expect.hasAssertions();

    const dir = track(workspace({ alpha: { suite: true } }));
    const result = run({
      root: dir,
      register: {},
      readFile: () => { throw new Error('ENOENT'); }
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain('Cannot read');
  });

  describe('readSonarExclusions', () => {
    it('joins backslash continuation lines before splitting', () => {
      expect.hasAssertions();

      const parsed = readSonarExclusions('/anywhere', () => sonarConfig(['alpha', 'beta']));

      expect([...parsed]).toStrictEqual([
        'ci-cd/check-fail-closed.js',
        'packages/alpha/**',
        'packages/beta/**'
      ]);
    });

    it('returns nothing when the key is absent', () => {
      expect.hasAssertions();

      expect([...readSonarExclusions('/anywhere', () => 'sonar.sources=apps\n')]).toStrictEqual([]);
    });
  });

  it('ignores an exclusion for a package directory that does not exist', () => {
    expect.hasAssertions();

    const dir = track(workspace({ alpha: { suite: true } }));

    // A package removed from the tree leaves its exclusion behind for a while.
    // That is stale configuration, not an untested package, and the check must
    // not invent a failure for a directory nobody can look at.
    expect(check(dir, {}, ['deleted-long-ago']).ok).toBe(true);
  });

  describe('main', () => {
    function recorder() {
      const logged: string[] = [];
      const io = {
        log: (message: string) => logged.push(message),
        error: (message: string) => logged.push(message)
      };
      return { io, logged };
    }

    it('returns 0 and reports when the check passes', () => {
      expect.hasAssertions();

      const { io, logged } = recorder();

      expect(main(io, () => ({ ok: true, message: 'all good' }))).toBe(0);
      expect(logged).toStrictEqual(['all good']);
    });

    it('returns 1 and reports when the check fails', () => {
      expect.hasAssertions();

      const { io, logged } = recorder();

      expect(main(io, () => ({ ok: false, message: 'nope' }))).toBe(1);
      expect(logged).toStrictEqual(['nope']);
    });
  });

  /**
   * The guard that decides whether the check runs at all. Inline as
   * `if (isEntryPoint(module))` no suite can reach it, which leaves the one line
   * making the gate binding unverified.
   */
  describe('runAsEntryPoint', () => {
    it('does nothing when the module is merely imported', () => {
      expect.hasAssertions();

      const exits: number[] = [];

      expect(runAsEntryPoint({
        caller: { id: 'imported' },
        entry: { id: 'something-else' },
        exit: (code: number) => exits.push(code),
        runMain: () => 0
      })).toBe(false);
      expect(exits).toStrictEqual([]);
    });

    it('reports the exit code when it is the entry point', () => {
      expect.hasAssertions();

      const entry = { id: 'the-entry-point' };
      const exits: number[] = [];

      expect(runAsEntryPoint({
        caller: entry,
        entry,
        exit: (code: number) => exits.push(code),
        runMain: () => 1
      })).toBe(true);
      expect(exits).toStrictEqual([1]);
    });
  });

  describe('the repository itself', () => {
    it('satisfies the check', () => {
      expect.hasAssertions();

      const result = run({ root: repoRoot });

      expect(result).toMatchObject({ ok: true });
    });
  });
});

describe('check-package-suites default wiring (JUM-821)', () => {
  it('runs against the working tree when called with no options at all', () => {
    expect.hasAssertions();

    // Every option has a production default; the bare call is the shape the
    // entry point uses, and it must read the real tree.
    const result = run();

    expect(result.ok).toBe(true);
  });

  it('main reports and returns 0 with its default io and check', () => {
    expect.hasAssertions();

    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      expect(main()).toBe(0);
      expect(log).toHaveBeenCalledWith(expect.stringContaining('Package suite check passed'));
    } finally {
      log.mockRestore();
    }
  });

  it('ignores a package whose src holds no runnable source file', () => {
    expect.hasAssertions();

    // A `src` of only Markdown owns no suite: the per-file filter is what
    // keeps docs-only sources from reading as untested code.
    const dir = workspace({});
    fs.mkdirSync(path.join(dir, 'packages', 'notes-only', 'src'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'packages', 'notes-only', 'src', 'notes.md'), '# notes\n');

    const result = run({ root: dir, register: {}, readFile: () => sonarConfig([]) });

    expect(result.ok).toBe(true);
  });
});
