/* eslint-disable @typescript-eslint/no-var-requires */
const matrixFs = require('fs');
const matrixPath = require('path');
const {
  FULL_TEST_MATRIX,
  executeMatrixCell,
  runAsEntryPoint,
  runFullTestMatrix,
  validateMatrixManifest,
  writeMatrixEvidence
} = require('../../../../../ci-cd/run-full-test-matrix');
const fullMatrixRootPackage = require('../../../../../package.json');

const fullMatrixRootDir = matrixPath.resolve(__dirname, '../../../../..');
type FullMatrixTestCell = { id: string; script: string };

describe('run-full-test-matrix', () => {
  it('declares unique required cells backed by real package scripts', () => {
    expect.hasAssertions();
    expect(FULL_TEST_MATRIX.length).toBeGreaterThan(0);
    expect(new Set(FULL_TEST_MATRIX.map((cell: FullMatrixTestCell) => cell.id)).size)
      .toBe(FULL_TEST_MATRIX.length);
    expect(new Set(FULL_TEST_MATRIX.map((cell: FullMatrixTestCell) => cell.script)).size)
      .toBe(FULL_TEST_MATRIX.length);

    for (const cell of FULL_TEST_MATRIX as FullMatrixTestCell[]) {
      expect(fullMatrixRootPackage.scripts[cell.script]).toStrictEqual(expect.any(String));
      expect(fullMatrixRootPackage.scripts[cell.script].trim()).not.toBe('');
    }
  });

  /**
   * The strict matrix guards promotion to `main`, so the coverage contract has
   * to be part of it — and the parts have to run in the right order.
   *
   * Both were wrong at once, and each hid in a different direction. Requirement
   * 110 moved coverage production out of `test:unit` (bun:test, no lcov) into
   * `test:coverage` (Jest), and neither the producer nor `coverage:check` was
   * ever added here. So the gate that decides what reaches `main` was not
   * checking the four thresholds at all, while `patch-coverage` read a report
   * nothing had written and failed with "Coverage file not found" — a red cell
   * that looked like a coverage shortfall and was actually a missing dependency.
   */
  it('produces coverage before the cells that consume it', () => {
    expect.hasAssertions();

    const ids = (FULL_TEST_MATRIX as FullMatrixTestCell[]).map((cell) => cell.id);

    expect(ids).toContain('coverage');
    expect(ids).toContain('coverage-thresholds');
    expect(ids).toContain('patch-coverage');

    // Cells run in declaration order, so position is the dependency.
    expect(ids.indexOf('coverage')).toBeLessThan(ids.indexOf('coverage-thresholds'));
    expect(ids.indexOf('coverage')).toBeLessThan(ids.indexOf('patch-coverage'));
  });

  describe('writeMatrixEvidence', () => {
    it('writes the evidence file and creates its directory', () => {
      expect.hasAssertions();

      const dir = matrixFs.mkdtempSync(
        matrixPath.join(require('node:os').tmpdir(), 'matrix-evidence-')
      );
      const target = matrixPath.join(dir, 'nested', 'matrix.json');

      writeMatrixEvidence({ outcome: 'passed' }, target);

      expect(JSON.parse(matrixFs.readFileSync(target, 'utf8'))).toStrictEqual({
        outcome: 'passed'
      });

      matrixFs.rmSync(dir, { recursive: true, force: true });
    });

    /** No destination means no evidence, not a crash on `path.resolve(undefined)`. */
    it('does nothing when no destination is configured', () => {
      expect.hasAssertions();

      expect(() => writeMatrixEvidence({ outcome: 'passed' }, undefined)).not.toThrow();
    });
  });

  describe('executeMatrixCell', () => {
    it('returns the exit status of the spawned script', () => {
      expect.hasAssertions();
      // A script that exists in package.json and does nothing expensive, so this
      // exercises the real spawn rather than an injected stand-in.
      expect(executeMatrixCell({ id: 'version', script: 'check-bun-version' })).toBe(0);
    });
  });

  /**
   * The guard that turns a failing matrix into a failing build. Inline as
   * `if (isEntryPoint(module))` it is unreachable from any suite, so the one
   * decision that makes the gate binding would go unverified.
   */
  describe('runAsEntryPoint', () => {
    it('does nothing when the module is merely imported', () => {
      expect.hasAssertions();

      const exits: number[] = [];
      const ran = runAsEntryPoint({
        caller: { id: 'imported' },
        entry: { id: 'something-else' },
        exit: (code: number) => exits.push(code),
        run: () => ({ outcome: 'passed' })
      });

      expect(ran).toBe(false);
      expect(exits).toStrictEqual([]);
    });

    /**
     * Reports 0 rather than leaving the exit code untouched. `process.exitCode`
     * defaults to 0, so the two are equivalent to the shell — but every guard
     * here now reports through the same shared helper, and a guard that stays
     * silent on success is the one whose wiring nobody notices is missing.
     */
    it('reports success as exit code 0', () => {
      expect.hasAssertions();

      const entry = { id: 'the-entry-point' };
      const exits: number[] = [];
      const ran = runAsEntryPoint({
        caller: entry,
        entry,
        exit: (code: number) => exits.push(code),
        run: () => ({ outcome: 'passed' })
      });

      expect(ran).toBe(true);
      expect(exits).toStrictEqual([0]);
    });

    it('exits non-zero when the matrix does not pass', () => {
      expect.hasAssertions();

      const entry = { id: 'the-entry-point' };
      const exits: number[] = [];
      runAsEntryPoint({
        caller: entry,
        entry,
        exit: (code: number) => exits.push(code),
        run: () => ({ outcome: 'failed' })
      });

      expect(exits).toStrictEqual([1]);
    });

    /**
     * A manifest that will not validate throws before any cell runs. That has to
     * fail the build too — a configuration error is the one case where nothing
     * was verified at all.
     */
    it('exits non-zero and reports when the manifest is invalid', () => {
      expect.hasAssertions();

      const entry = { id: 'the-entry-point' };
      const exits: number[] = [];
      const logged: unknown[] = [];

      runAsEntryPoint({
        caller: entry,
        entry,
        exit: (code: number) => exits.push(code),
        logger: { error: (message: unknown) => logged.push(message) },
        run: () => { throw new Error('manifest is broken'); }
      });

      expect(exits).toStrictEqual([1]);
      expect(logged[0]).toContain('configuration is invalid');
    });
  });

  it('fails closed for an empty, duplicate, or missing-script manifest', () => {
    expect.hasAssertions();
    expect(() => validateMatrixManifest([], fullMatrixRootPackage.scripts))
      .toThrow('at least one required cell');
    expect(() => validateMatrixManifest([
      { id: 'same', script: 'lint' },
      { id: 'same', script: 'test:unit' }
    ], fullMatrixRootPackage.scripts)).toThrow('Duplicate full-matrix cell id');
    expect(() => validateMatrixManifest([
      { id: 'missing', script: 'test:does-not-exist' }
    ], fullMatrixRootPackage.scripts)).toThrow('missing from package.json');
  });

  it('reports every cell and rejects a deliberate failure without stopping early', () => {
    expect.hasAssertions();
    const cells = [
      { id: 'before', script: 'lint' },
      { id: 'deliberate-failure', script: 'test:unit' },
      { id: 'after', script: 'build:dev' }
    ];
    const execute = jest.fn()
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(17)
      .mockReturnValueOnce(0);
    const logger = { log: jest.fn(), error: jest.fn() };

    const evidence = runFullTestMatrix({
      cells,
      execute,
      logger,
      availableScripts: fullMatrixRootPackage.scripts,
      resultFile: ''
    });

    expect(execute.mock.calls).toStrictEqual([
      [cells[0]],
      [cells[1]],
      [cells[2]]
    ]);
    expect(evidence.outcome).toBe('failed');
    expect(evidence.requiredCellCount).toBe(3);
    expect(evidence.reportedCellCount).toBe(3);
    expect(evidence.results[1]).toStrictEqual({
      id: 'deliberate-failure',
      script: 'test:unit',
      state: 'failed',
      status: 17
    });
  });

  it('treats missing execution status and crashes as failures', () => {
    expect.hasAssertions();
    const logger = { log: jest.fn(), error: jest.fn() };
    const missingStatus = runFullTestMatrix({
      cells: [{ id: 'missing-status', script: 'lint' }],
      execute: () => null,
      logger,
      availableScripts: fullMatrixRootPackage.scripts,
      resultFile: ''
    });
    const crashed = runFullTestMatrix({
      cells: [{ id: 'crashed', script: 'lint' }],
      execute: () => {
        throw new Error('deliberate crash');
      },
      logger,
      availableScripts: fullMatrixRootPackage.scripts,
      resultFile: ''
    });

    expect(missingStatus.outcome).toBe('failed');
    expect(crashed.outcome).toBe('failed');
  });

  it('uses repository-owned workflows and keeps Storybook outside the full matrix', () => {
    expect.hasAssertions();
    const read = (file: string) => matrixFs.readFileSync(
      matrixPath.join(fullMatrixRootDir, file),
      'utf8'
    );

    expect(fullMatrixRootPackage.scripts['ci:gate:strict'])
      .toBe('bun ci-cd/run-full-test-matrix.js');
    expect(fullMatrixRootPackage.scripts['ci:gate:branch'])
      .toBe('bun ci-cd/run-branch-quality-gate.js');
    expect(fullMatrixRootPackage.scripts['ci:gate:task'])
      .toBe('bun ci-cd/run-task-change-tests.js');
    expect([
      read('.husky/pre-commit').includes('bun run ci:gate:branch'),
      read('.husky/pre-push').includes('bun run ci:gate:branch'),
      read('.husky/pre-merge-commit').includes('bun run ci:gate:branch'),
      read('.github/workflows/test.yml').includes('bun run ci:gate:branch'),
      read('.github/workflows/test.yml').includes('JUMENTIX_TASK_TEST_MODE: range'),
      read('.github/workflows/test.yml').includes('JUMENTIX_TASK_TEST_BASE: origin/dev'),
      read('.github/workflows/test.yml').includes('full-test-matrix.json'),
      read('.github/workflows/website.yml').includes('bun run website:storybook:build'),
      read('.github/workflows/website.yml').includes('bun run website:storybook:smoke'),
      read('.github/workflows/coverage.yml').includes('bun run coverage:patch'),
      !matrixFs.existsSync(matrixPath.join(fullMatrixRootDir, '.circleci', 'config.yml')),
      FULL_TEST_MATRIX.some((cell: FullMatrixTestCell) => cell.script === 'pr:governance:check'),
      FULL_TEST_MATRIX.some((cell: FullMatrixTestCell) => cell.script === 'requirements:check'),
      FULL_TEST_MATRIX.some((cell: FullMatrixTestCell) => cell.script === 'integrations:check'),
      FULL_TEST_MATRIX.some((cell: FullMatrixTestCell) => cell.script === 'integration-migration:check'),
      FULL_TEST_MATRIX.some((cell: FullMatrixTestCell) => cell.script === 'agent-registry:check'),
      FULL_TEST_MATRIX.some((cell: FullMatrixTestCell) => cell.script === 'website:test:prepublish'),
      !FULL_TEST_MATRIX.some(
        (cell: FullMatrixTestCell) => cell.script.startsWith('website:storybook')
      )
    ]).toStrictEqual([
      true, true, true, true, true, true, true, true, true, true, true, true, true, true,
      true, true, true, true
    ]);
  });
});
