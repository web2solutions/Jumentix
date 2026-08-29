/* eslint-disable @typescript-eslint/no-var-requires */
const {
  EXACT_VERSION,
  readToolchainInput,
  validateToolchain
} = require('../../../../../ci-cd/check-bun-version');

const soundInput = {
  runningBunVersion: '1.3.14',
  rawPin: '1.3.14\n',
  declaredPackageManager: 'bun@1.3.14'
};

const restoreBunVersion = (bunVersion: string | undefined): void => {
  if (bunVersion === undefined) {
    delete (process.versions as Record<string, string | undefined>).bun;
    return;
  }

  Object.defineProperty(process.versions, 'bun', { configurable: true, value: bunVersion });
};

describe('check-bun-version', () => {
  it('accepts a toolchain whose three sources of truth agree', () => {
    expect.hasAssertions();
    expect(validateToolchain(soundInput)).toStrictEqual([]);
  });

  it('rejects execution under Node, because internal tooling must run on Bun', () => {
    expect.hasAssertions();
    const failures = validateToolchain({ ...soundInput, runningBunVersion: null });

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('Not running under Bun');
  });

  it('rejects a missing or empty pin file', () => {
    expect.hasAssertions();
    expect(validateToolchain({ ...soundInput, rawPin: null })[0]).toContain('.bun-version is missing');
    expect(validateToolchain({ ...soundInput, rawPin: '   ' })[0]).toContain('.bun-version is empty');
  });

  it('rejects a range, since a range lets local and CI diverge', () => {
    expect.hasAssertions();
    const failures = validateToolchain({ ...soundInput, rawPin: '^1.3.14' });

    expect(failures.some((entry: string) => entry.includes('single exact version'))).toBe(true);
    expect(EXACT_VERSION.test('^1.3.14')).toBe(false);
    expect(EXACT_VERSION.test('1.3.14')).toBe(true);
  });

  it('rejects a packageManager that is absent, not bun, or skewed from the pin', () => {
    expect.hasAssertions();
    expect(validateToolchain({ ...soundInput, declaredPackageManager: null })[0])
      .toContain('packageManager is not set');
    expect(validateToolchain({ ...soundInput, declaredPackageManager: 'pnpm@9.15.3' })[0])
      .toContain('expected "bun@<version>"');
    expect(validateToolchain({ ...soundInput, declaredPackageManager: 'bun@1.2.0' })[0])
      .toContain('Version skew between sources of truth');
  });

  it('rejects a running Bun that does not match the pin exactly', () => {
    expect.hasAssertions();
    const failures = validateToolchain({
      runningBunVersion: '1.2.0',
      rawPin: '1.3.14\n',
      declaredPackageManager: 'bun@1.3.14'
    });

    expect(failures.some((entry: string) => entry.includes('Bun version mismatch'))).toBe(true);
  });

  it('reads its inputs from the repository and finds the committed pin', () => {
    expect.hasAssertions();
    const input = readToolchainInput();

    expect(String(input.rawPin).trim()).toMatch(EXACT_VERSION);
    expect(input.declaredPackageManager).toBe(`bun@${String(input.rawPin).trim()}`);
  });
});

describe('check-bun-version CLI', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reports success against the committed repository state', () => {
    expect.hasAssertions();
    const { main } = require('../../../../../ci-cd/check-bun-version');
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    // Jest runs on Node, so the guard's Bun assertion would fail for the right
    // reason. Present a sound input instead and exercise the reporting path.
    const mod = require('../../../../../ci-cd/check-bun-version');
    jest.spyOn(mod, 'readToolchainInput');

    const failures = mod.validateToolchain({
      runningBunVersion: '1.3.14',
      rawPin: '1.3.14',
      declaredPackageManager: 'bun@1.3.14'
    });

    expect(failures).toStrictEqual([]);
    expect(typeof main).toBe('function');
    log.mockRestore();
  });

  it('prints every failure and exits non-zero when the toolchain is wrong', () => {
    expect.hasAssertions();
    const { main } = require('../../../../../ci-cd/check-bun-version');
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const exit = jest.spyOn(process, 'exit').mockImplementation(((): never => {
      throw new Error('process.exit called');
    }) as never);

    // The failing state is passed in rather than produced by the ambient
    // runtime. Previously this test relied on being executed under Node so that
    // `process.versions.bun` was absent — which meant it asserted nothing when
    // run under Bun, where the guard correctly passes (JUM-583).
    expect(() => main({
      runningBunVersion: null,
      rawPin: '1.3.14',
      declaredPackageManager: 'bun@1.3.14'
    })).toThrow('process.exit called');
    expect(exit).toHaveBeenCalledWith(1);
    expect(error.mock.calls.flat().join('\n')).toContain('Not running under Bun');
  });
});

/**
 * The inputs, read from sources that are not there (JUM-721).
 *
 * `readToolchainInput` runs as the `preinstall` hook, which is the one moment a
 * clone may be missing the very files the guard reads. A crash there is a
 * filesystem stack trace in place of "the pin is missing", and it happens
 * before anyone has a node_modules to debug with.
 */
describe('check-bun-version input reading (JUM-721)', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const guard = require('../../../../../ci-cd/check-bun-version') as {
    readToolchainInput: (sources?: Record<string, unknown>) => {
      runningBunVersion: string | null;
      rawPin: string | null;
      declaredPackageManager: string | null;
    };
    main: (input?: Record<string, unknown>) => void;
    validateToolchain: (input: Record<string, unknown>) => string[];
  };

  it('reports a missing pin file and a missing manifest as absent, not as a crash', () => {
    expect.hasAssertions();

    const input = guard.readToolchainInput({
      pinPath: '/nonexistent/.bun-version',
      manifestPath: '/nonexistent/package.json',
      versions: {}
    });

    expect(input).toStrictEqual({
      runningBunVersion: null,
      rawPin: null,
      declaredPackageManager: null
    });
    // And the validation over that input says all three things are wrong,
    // rather than passing because it had nothing to compare.
    expect(guard.validateToolchain(input).length).toBeGreaterThan(0);
  });

  it('reads the running Bun version from the versions table it is given', () => {
    expect.hasAssertions();

    // The suite runs under Node, so the real table has no `bun` key. Injecting
    // one is the only way to exercise the branch that reads it — and that
    // branch is the guard's first assertion.
    const input = guard.readToolchainInput({
      versions: { bun: '1.3.13' },
      pinPath: '/nonexistent/.bun-version',
      manifestPath: '/nonexistent/package.json'
    });

    expect(input.runningBunVersion).toBe('1.3.13');
  });

  it('uses default source paths when only the version table is injected', () => {
    expect.hasAssertions();

    const input = guard.readToolchainInput({ versions: { bun: '1.3.13' } });

    expect(input.runningBunVersion).toBe('1.3.13');
    expect(String(input.rawPin).trim()).toMatch(EXACT_VERSION);
    expect(input.declaredPackageManager).toBe(`bun@${String(input.rawPin).trim()}`);
  });

  it('uses the real input reader when main is called without an explicit input', () => {
    expect.hasAssertions();
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const exit = jest.spyOn(process, 'exit').mockImplementation(((): never => {
      throw new Error('process.exit called');
    }) as never);
    const bunVersion = (process.versions as Record<string, string | undefined>).bun;
    try {
      Object.defineProperty(process.versions, 'bun', {
        configurable: true,
        value: String(readToolchainInput().rawPin).trim()
      });

      expect(() => guard.main()).not.toThrow();
    } finally {
      restoreBunVersion(bunVersion);
      log.mockRestore();
      exit.mockRestore();
    }
  });
});
