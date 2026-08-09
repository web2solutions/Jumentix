/* eslint-disable @typescript-eslint/no-var-requires */
const matrixFs = require('fs');
const matrixPath = require('path');
const {
  FULL_TEST_MATRIX,
  executeMatrixCell,
  resolveMatrixCells,
  runAsEntryPoint,
  runFullTestMatrix,
  validateMatrixManifest,
  writeMatrixEvidence
} = require('../../../../../ci-cd/run-full-test-matrix');
const fullMatrixRootPackage = require('../../../../../package.json');

const fullMatrixRootDir = matrixPath.resolve(__dirname, '../../../../..');
type FullMatrixTestCell = { id: string; script: string };

describe('run-full-test-matrix', () => {
  it('keeps the canonical ci gate free of missing script references', () => {
    expect.hasAssertions();

    const ciGate = fullMatrixRootPackage.scripts['ci:gate'];
    const referenced = [...ciGate.matchAll(/\bbun run ([^\s&|]+)/g)]
      .map((match: RegExpMatchArray) => match[1]);
    const missing = referenced.filter((script: string) => !fullMatrixRootPackage.scripts[script]);

    expect(missing).toStrictEqual([]);
  });

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

  it('keeps heavy coverage production in GitHub Actions instead of the local strict matrix', () => {
    expect.hasAssertions();

    const ids = (FULL_TEST_MATRIX as FullMatrixTestCell[]).map((cell) => cell.id);
    const workflow = matrixFs.readFileSync(
      matrixPath.join(fullMatrixRootDir, '.github/workflows/ci.yml'),
      'utf8'
    );

    expect(ids).toStrictEqual(expect.not.arrayContaining([
      'coverage',
      'browser-coverage',
      'browser-lcov',
      'coverage-thresholds',
      'patch-coverage'
    ]));
    expect(workflow).toContain('bun run test:coverage');
    expect(workflow).toContain('bun run coverage:check');
    expect(workflow).toContain('bun run coverage:patch');
  });

  it('leaves the coverage scripts available for the GitHub Actions coverage gate', () => {
    expect.hasAssertions();

    expect(fullMatrixRootPackage.scripts['test:coverage'])
      .toContain('--coverageThreshold=\'{}\'');
    expect(fullMatrixRootPackage.scripts['coverage:browser-lcov'])
      .toBe('bun ci-cd/write-browser-lcov.js');
    expect(fullMatrixRootPackage.scripts['coverage:patch'])
      .toBe('bun ci-cd/check-patch-coverage.js');
  });

  it('allows GitHub Actions to delegate expensive cells to dedicated jobs', () => {
    expect.hasAssertions();

    const cells = resolveMatrixCells(FULL_TEST_MATRIX, {
      JUMENTIX_FULL_MATRIX_SKIP_CELLS: 'workspace-builds,workspace-tests,website-prepublish,integration'
    });

    expect(cells).toStrictEqual(expect.not.arrayContaining([
      expect.objectContaining({ id: 'workspace-builds' }),
      expect.objectContaining({ id: 'workspace-tests' }),
      expect.objectContaining({ id: 'website-prepublish' }),
      expect.objectContaining({ id: 'integration' })
    ]));
    expect(cells).toStrictEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'backend-build' })
    ]));
  });

  it('fails closed when the delegated matrix skip list names an unknown cell', () => {
    expect.hasAssertions();

    expect(() => resolveMatrixCells(FULL_TEST_MATRIX, {
      JUMENTIX_FULL_MATRIX_SKIP_CELLS: 'not-a-cell'
    })).toThrow('unknown cell');
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
      env: {},
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
      env: {},
      resultFile: ''
    });
    const crashed = runFullTestMatrix({
      cells: [{ id: 'crashed', script: 'lint' }],
      execute: () => {
        throw new Error('deliberate crash');
      },
      logger,
      availableScripts: fullMatrixRootPackage.scripts,
      env: {},
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
      read('.husky/pre-commit').includes('check-commit-authorship.js --identity'),
      read('.husky/pre-push').includes('check-commit-authorship.js'),
      read('.github/workflows/ci.yml').includes('bun run ci:gate:branch'),
      read('.github/workflows/ci.yml').includes('JUMENTIX_TASK_TEST_MODE: range'),
      read('.github/workflows/ci.yml').includes('JUMENTIX_TASK_TEST_BASE: origin/dev'),
      read('.github/workflows/ci.yml').includes('full-test-matrix.json'),
      read('.github/workflows/ci.yml').includes('JUMENTIX_CI_GATE_RESULT_FILE: artifacts/ci/branch-quality-gate.json'),
      read('.github/workflows/ci.yml').includes('JUMENTIX_CI_MATRIX_RESULT_FILE: artifacts/ci/full-test-matrix.json'),
      read('.github/workflows/ci.yml').includes('JUMENTIX_FULL_MATRIX_SKIP_CELLS: workspace-builds,workspace-tests,website-prepublish,integration'),
      read('.github/workflows/ci.yml').includes('name: Run workspace package builds'),
      read('.github/workflows/ci.yml').includes('bun run mono:build'),
      read('.github/workflows/ci.yml').includes('name: Run workspace package tests'),
      read('.github/workflows/ci.yml').includes('bun run mono:test'),
      read('.github/workflows/ci.yml').includes('name: Run integration matrix'),
      read('.github/workflows/ci.yml').includes('bun run ci:integration'),
      !read('.github/workflows/ci.yml').includes('requirepass'),
      !read('.github/workflows/ci.yml').includes('AAA_REDIS_PASSWORD'),
      read('.github/workflows/ci.yml').includes('bun run website:storybook:build'),
      read('.github/workflows/ci.yml').includes('bun run website:storybook:smoke'),
      read('.github/workflows/ci.yml').includes('bun run website:test:cypress'),
      read('.github/workflows/ci.yml').includes('bun run coverage:patch'),
      read('.github/workflows/ci.yml').includes('codecov --verbose upload-process'),
      FULL_TEST_MATRIX.some((cell: FullMatrixTestCell) => cell.script === 'pr:governance:check'),
      FULL_TEST_MATRIX.some((cell: FullMatrixTestCell) => cell.script === 'requirements:check'),
      FULL_TEST_MATRIX.some((cell: FullMatrixTestCell) => cell.script === 'integrations:check'),
      FULL_TEST_MATRIX.some((cell: FullMatrixTestCell) => cell.script === 'ci:check-third-party-review'),
      FULL_TEST_MATRIX.some((cell: FullMatrixTestCell) => cell.script === 'integration-migration:check'),
      FULL_TEST_MATRIX.some((cell: FullMatrixTestCell) => cell.script === 'agent-registry:check'),
      FULL_TEST_MATRIX.some((cell: FullMatrixTestCell) => cell.script === 'website:test:prepublish'),
      !FULL_TEST_MATRIX.some(
        (cell: FullMatrixTestCell) => cell.script.startsWith('website:storybook')
      )
    ]).toStrictEqual(Array(33).fill(true));
  });
});
