/* eslint-disable @typescript-eslint/no-var-requires */
const matrixFs = require('fs');
const matrixPath = require('path');
const {
  FULL_TEST_MATRIX,
  runFullTestMatrix,
  validateMatrixManifest
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

  it('uses branch-aware gates and keeps Storybook in its own CircleCI job', () => {
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
      // Mirrored from the three GitHub Actions workflows into CircleCI
      // (Requirement 107). Both providers run, and each must cover the same
      // checks — two providers checking different things are two partial
      // pipelines, not redundancy.
      read('.circleci/config.yml').includes('bun run ci:gate:branch'),
      read('.circleci/config.yml').includes('JUMENTIX_TASK_TEST_MODE=range'),
      read('.circleci/config.yml').includes('JUMENTIX_TASK_TEST_BASE=origin/dev'),
      read('.circleci/config.yml').includes('full-test-matrix.json'),
      read('.circleci/config.yml').includes('bun run website:storybook:build'),
      read('.circleci/config.yml').includes('bun run website:storybook:smoke'),
      // The quality gate runs on every branch now. The previous configuration
      // filtered to dev and main, which left feature branches with no signal.
      !/- quality-gate:\s*\n\s*filters:/.test(read('.circleci/config.yml')),
      // Storybook stays in its own job rather than being folded into the gate.
      !read('.circleci/config.yml').includes('ci:gate:branch\n      - run:\n          name: Build Storybook'),
      // GitHub Actions stays. An earlier revision of 107 retired it, written
      // while it could not execute at all; billing was resolved and the
      // workflows were restored, so their absence is now the regression.
      matrixFs.existsSync(matrixPath.join(fullMatrixRootDir, '.github', 'workflows')),
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
      true, true, true, true, true
    ]);
  });
});
