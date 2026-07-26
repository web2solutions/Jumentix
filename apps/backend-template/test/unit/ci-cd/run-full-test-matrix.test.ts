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

  it('uses branch-aware gates at commit, push, merge, CircleCI, and GitHub PR boundaries', () => {
    expect.hasAssertions();
    const read = (file: string) => matrixFs.readFileSync(
      matrixPath.join(fullMatrixRootDir, file),
      'utf8'
    );

    expect(fullMatrixRootPackage.scripts['ci:gate:strict'])
      .toBe('node ci-cd/run-full-test-matrix.js');
    expect(fullMatrixRootPackage.scripts['ci:gate:branch'])
      .toBe('node ci-cd/run-branch-quality-gate.js');
    expect(read('.husky/pre-commit')).toContain('pnpm@9.15.3 run ci:gate:branch');
    expect(read('.husky/pre-push')).toContain('pnpm@9.15.3 run ci:gate:branch');
    expect(read('.husky/pre-merge-commit')).toContain('pnpm@9.15.3 run ci:gate:branch');
    expect(read('.circleci/config.yml')).toContain('pnpm@9.15.3 run ci:gate:branch');
    expect(read('.github/workflows/test.yml')).toContain('pnpm run ci:gate:branch');
    expect(read('.github/workflows/test.yml')).toContain('github.base_ref || github.ref_name');
  });
});
