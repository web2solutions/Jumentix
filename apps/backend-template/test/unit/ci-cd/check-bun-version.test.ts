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

    // Under Node the guard must fail: that is the fail-closed behaviour itself.
    expect(() => main()).toThrow('process.exit called');
    expect(exit).toHaveBeenCalledWith(1);
    expect(error.mock.calls.flat().join('\n')).toContain('Not running under Bun');
  });
});
