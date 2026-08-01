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
    expect(failures[0]).toContain('expected "^8.5.23"');
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

    expect(log.mock.calls.flat().join('\n')).toContain('16 pins');
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
