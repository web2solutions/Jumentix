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
    expect(detectRetiredSurfaces()).toStrictEqual([]);
    expect(validateOverrideIntegrity(overrideGuardRootPackage, detectRetiredSurfaces())).toStrictEqual([]);
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

    const real = fs.readFileSync;
    jest.spyOn(fs, 'readFileSync').mockImplementation(((file: string, ...rest: unknown[]) => {
      if (String(file).endsWith('package.json')) {
        const pkg = JSON.parse(String(real(file, 'utf8')));
        delete pkg.overrides['form-data'];
        return JSON.stringify(pkg);
      }
      return real(file, ...(rest as []));
    }) as never);

    expect(() => mod.main()).toThrow('process.exit called');
    expect(exit).toHaveBeenCalledWith(1);
    expect(error.mock.calls.flat().join('\n')).toContain('override "form-data" is missing');
  });
});
