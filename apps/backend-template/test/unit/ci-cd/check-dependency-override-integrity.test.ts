/* eslint-disable @typescript-eslint/no-var-requires */
const {
  REQUIRED_OVERRIDES,
  REQUIRED_PATCHES,
  REQUIRED_RESOLUTIONS,
  detectRetiredSurfaces,
  validateOverrideIntegrity
} = require('../../../../../ci-cd/check-dependency-override-integrity');

const overrideGuardRootPackage = require('../../../../../package.json');

/** A manifest that satisfies the frozen baseline exactly. */
const soundManifest = () => ({
  overrides: { ...REQUIRED_OVERRIDES },
  resolutions: { ...REQUIRED_RESOLUTIONS },
  patchedDependencies: { ...REQUIRED_PATCHES }
});

describe('check-dependency-override-integrity', () => {
  it('accepts a manifest that carries the full frozen baseline', () => {
    expect.hasAssertions();
    expect(validateOverrideIntegrity(soundManifest())).toStrictEqual([]);
  });

  it('rejects a dropped pin, because losing one is a silent security regression', () => {
    expect.hasAssertions();
    const manifest = soundManifest();
    delete manifest.overrides['form-data'];

    const failures = validateOverrideIntegrity(manifest);

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('override "form-data" is missing');
    expect(failures[0]).toContain('vulnerable transitive version resolve again');
  });

  it('rejects a relaxed range even when the pin is still present', () => {
    expect.hasAssertions();
    const manifest = soundManifest();
    manifest.overrides.postcss = '^8.5.18';

    const failures = validateOverrideIntegrity(manifest);

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('expected "^8.5.26"');
  });

  it('rejects pnpm nested-selector syntax, which resolves to nothing under Bun and npm', () => {
    expect.hasAssertions();
    const manifest = soundManifest();
    manifest.overrides['restify>find-my-way'] = '^9.7.0';

    const failures = validateOverrideIntegrity(manifest);

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('EINVALIDTAGNAME');
  });

  it('rejects a dropped patch and a patch whose file is absent', () => {
    expect.hasAssertions();
    const withoutPatch = soundManifest();
    withoutPatch.patchedDependencies = {};

    expect(validateOverrideIntegrity(withoutPatch)[0]).toContain('patchedDependencies is missing');
    expect(validateOverrideIntegrity(soundManifest(), [], () => false)[0])
      .toContain('does not exist on disk');
  });

  it('rejects a resurrected pnpm surface or pnpm section', () => {
    expect.hasAssertions();
    expect(validateOverrideIntegrity(soundManifest(), ['pnpm-workspace.yaml'])[0])
      .toContain('pnpm-workspace.yaml still exists');

    const withPnpmSection = { ...soundManifest(), pnpm: { overrides: {} } };

    expect(validateOverrideIntegrity(withPnpmSection)[0])
      .toContain('still declares a "pnpm" section');
  });

  it('rejects a missing resolution', () => {
    expect.hasAssertions();
    const manifest = soundManifest();
    manifest.resolutions = {};

    expect(validateOverrideIntegrity(manifest)[0]).toContain('resolution "serverless"');
  });

  it('confirms the committed manifest passes and the pnpm surfaces stay retired', () => {
    expect.hasAssertions();
    const retired = detectRetiredSurfaces();

    expect(retired).toStrictEqual([]);
    expect(validateOverrideIntegrity(overrideGuardRootPackage, retired)).toStrictEqual([]);
  });
});

describe('check-dependency-override-integrity CLI', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reports the intact pin counts against the committed manifest', () => {
    expect.hasAssertions();
    const { main } = require('../../../../../ci-cd/check-dependency-override-integrity');
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    main();

    expect(log.mock.calls.flat().join('\n')).toContain('19 pins');
  });

  it('prints each failure and exits non-zero when a pin is missing', () => {
    expect.hasAssertions();
    const mod = require('../../../../../ci-cd/check-dependency-override-integrity');
    const fs = require('fs');
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const exit = jest.spyOn(process, 'exit').mockImplementation(((): never => {
      throw new Error('process.exit called');
    }) as never);

    // Precomputed outside the mock: a conditional inside the test body trips
    // jest/no-conditional-in-test, and the guard only ever reads package.json.
    const brokenManifest = JSON.stringify({
      ...overrideGuardRootPackage,
      overrides: Object.fromEntries(
        Object.entries(overrideGuardRootPackage.overrides)
          .filter(([name]) => name !== 'form-data')
      )
    });
    jest.spyOn(fs, 'readFileSync').mockReturnValue(brokenManifest as never);

    expect(() => mod.main()).toThrow('process.exit called');
    expect(exit).toHaveBeenCalledWith(1);
    expect(error.mock.calls.flat().join('\n')).toContain('override "form-data" is missing');
  });
});

/**
 * The failure this guard was added for (JUM-587).
 *
 * An override that crosses a major hands the dependent a package with a
 * different API. Nothing fails at install and nothing fails at boot — the
 * dependent loads, and then throws on a code path nobody exercises until a
 * user does. `send: ^1.2.0` against Express 4's `send: ~0.19.0` removed `mime@1`
 * from the tree, and Express 4's `res.json()` calls `mime.charsets.lookup(...)`.
 *
 * Driven through the injected reader rather than the installed tree, so the
 * broken state stays reproducible after the Express 5 upgrade fixed it.
 */
describe('override major compatibility', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const guard = require('../../../../../ci-cd/check-dependency-override-integrity') as {
    validateOverrideMajors: (
      pkg: { overrides?: Record<string, string> },
      read: (dependent: string, overridden: string) => string | null
    ) => string[];
    rangeMajor: (range: string) => number | null;
    readInstalledDependentRange: (dependent: string, overridden: string) => string | null;
  };
  const { validateOverrideMajors, rangeMajor } = guard;

  it('rejects an override that crosses the major its dependent declares', () => {
    expect.hasAssertions();
    const failures = validateOverrideMajors(
      { overrides: { send: '^1.2.0' } },
      () => '~0.19.0'
    );

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('declares ~0.19.0 but the override forces ^1.2.0');
  });

  it('accepts an override inside the declared major', () => {
    expect.hasAssertions();
    // Express 5, which is what fixed it: `send: ^1.1.0` and no `mime@1` call site.
    const failures = validateOverrideMajors(
      { overrides: { send: '^1.2.0' } },
      () => '^1.1.0'
    );

    expect(failures).toStrictEqual([]);
  });

  it('says nothing when the override is absent', () => {
    expect.hasAssertions();
    // No override means no forcing, so there is nothing to compare against.
    expect(validateOverrideMajors({ overrides: {} }, () => '^1.1.0')).toStrictEqual([]);
  });

  it('fails when the dependent no longer declares the overridden package', () => {
    expect.hasAssertions();
    // Otherwise the pair rots into an assertion about nothing, which is the
    // state that lets the next one through.
    const failures = validateOverrideMajors(
      { overrides: { send: '^1.2.0' } },
      () => null
    );

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('no longer depends on');
  });

  it.each([
    ['^1.2.0', 1],
    ['~0.19.0', 0],
    ['1.x', 1],
    ['>=2.0.0 <3', 2],
    ['not-a-range', null]
  ])('reads the major of %p as %p', (range, expected) => {
    expect.hasAssertions();
    expect(rangeMajor(range)).toBe(expected);
  });

  it('passes against the real installed tree', () => {
    expect.hasAssertions();
    // The control. Without it the suite only ever proves the checker can fail.
    expect(validateOverrideMajors(
      overrideGuardRootPackage,
      guard.readInstalledDependentRange
    )).toStrictEqual([]);
  });
});

/**
 * The reader that resolves a dependent's declared range.
 *
 * It is what makes the major-compatibility guard read the tree instead of a
 * hardcoded expectation, and its failure path — a dependent that is not
 * installed — decides whether the guard reports a stale pairing or crashes
 * mid-check.
 */
describe('installed dependent range reader', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const guardModule = require('../../../../../ci-cd/check-dependency-override-integrity') as {
    readInstalledDependentRange: (dependent: string, overridden: string) => string | null;
  };

  it('reads the range a dependent declares for one of its dependencies', () => {
    expect.hasAssertions();
    // Against the real tree, so the guard is shown to read what is installed
    // rather than what a fixture claims.
    expect(guardModule.readInstalledDependentRange('express', 'send')).toMatch(/^\^1\./);
  });

  it('returns null for a package that is not installed', () => {
    expect.hasAssertions();
    // Rather than throwing: `validateOverrideMajors` turns null into a stated
    // failure about a stale pairing, which is a better message than a resolution
    // error from inside a guard nobody was reading.
    expect(guardModule.readInstalledDependentRange('not-a-real-package', 'send')).toBeNull();
  });

  it('returns null when the dependent does not declare that dependency', () => {
    expect.hasAssertions();
    expect(guardModule.readInstalledDependentRange('express', 'not-a-real-dependency')).toBeNull();
  });
});

/**
 * The two paths the major-compatibility guard takes before it compares
 * anything (JUM-681).
 *
 * The mismatch itself is covered above. What was not: the early return for an
 * override the manifest does not carry, and the accepting path. Between them
 * they are the difference between "this pin is fine" and "this pin was never
 * looked at", which read the same in a passing build.
 */
describe('override major compatibility, before the comparison (JUM-681)', () => {
  // Required locally, matching the suite above: the module is CommonJS and the
  // top-level import list is the shape the other describes already use.
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const majors = require('../../../../../ci-cd/check-dependency-override-integrity') as {
    OVERRIDE_MAJOR_COMPATIBILITY: Array<{
      dependent: string; overridden: string; requiredMajor: number;
    }>;
    validateOverrideMajors: (
      pkg: { overrides?: Record<string, string> },
      read: (dependent: string, overridden: string) => string | null
    ) => string[];
  };
  const [firstPair] = majors.OVERRIDE_MAJOR_COMPATIBILITY;

  it('says nothing about an override the manifest does not carry', () => {
    expect.hasAssertions();

    // Absence is the concern of `validateOverrideIntegrity`; reporting it twice
    // would make one dropped pin look like two unrelated problems.
    expect(majors.validateOverrideMajors({ overrides: {} }, () => '^1.0.0')).toStrictEqual([]);
  });

  it('accepts a dependent still declaring the expected major', () => {
    expect.hasAssertions();

    const failures = majors.validateOverrideMajors(
      { overrides: { [firstPair.overridden]: '1.2.3' } },
      () => `^${String(firstPair.requiredMajor)}.0.0`
    );

    expect(failures).toStrictEqual([]);
  });
});

/**
 * The rest of the major-compatibility guard (JUM-681).
 *
 * The pairing it enforces is the one that broke LoopBack and Sails: `send` was
 * overridden to `^1.2.0` for Express 5 while Express 4 still reached into
 * `send@0`'s `mime.charsets`. Each branch below is a way that guard can go
 * quiet — a dependent that dropped the dependency, a range it cannot parse, a
 * mismatch it should report.
 */
describe('override major compatibility, the remaining branches (JUM-681)', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const guard = require('../../../../../ci-cd/check-dependency-override-integrity') as {
    OVERRIDE_MAJOR_COMPATIBILITY: Array<{
      dependent: string; overridden: string; requiredMajor: number;
    }>;
    rangeMajor: (range: string) => number | null;
    validateOverrideMajors: (
      pkg: { overrides?: Record<string, string> },
      read: (dependent: string, overridden: string) => string | null
    ) => string[];
    readInstalledDependentRange: (dependent: string, overridden: string) => string | null;
  };
  const [pair] = guard.OVERRIDE_MAJOR_COMPATIBILITY;

  it('reads the leading major out of every range shape it will meet', () => {
    expect.hasAssertions();

    expect(guard.rangeMajor('^1.2.0')).toBe(1);
    expect(guard.rangeMajor('~0.19.0')).toBe(0);
    expect(guard.rangeMajor('2.x')).toBe(2);
    // Not a version at all — reported as unknown rather than coerced to 0,
    // which would read as "major 0" and compare equal to `~0.x`.
    expect(guard.rangeMajor('latest')).toBeNull();
  });

  it('says so when the dependent no longer depends on the overridden package', () => {
    expect.hasAssertions();

    // The pairing outlived its reason: the override may now be pinning
    // something for nobody.
    const failures = guard.validateOverrideMajors(
      { overrides: { [pair.overridden]: '1.2.3' } },
      () => null
    );

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('no longer depends on');
  });

  it('rejects an override whose major differs from the dependent declaration', () => {
    expect.hasAssertions();

    const failures = guard.validateOverrideMajors(
      { overrides: { [pair.overridden]: '9.0.0' } },
      () => `^${String(pair.requiredMajor)}.0.0`
    );

    expect(failures.join(' ')).toContain(pair.dependent);
  });

  it('returns null for a dependent that is not installed', () => {
    expect.hasAssertions();

    // A missing package must not crash the guard on a partial tree.
    expect(guard.readInstalledDependentRange('no-such-package-here', 'send')).toBeNull();
  });
});
