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

const restoreEnv = (name: string, previous: string | undefined): void => {
  if (previous === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = previous;
};

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

  it('uses the real environment when no explicit skip environment is injected', () => {
    expect.hasAssertions();
    const previous = process.env.JUMENTIX_FULL_MATRIX_SKIP_CELLS;
    process.env.JUMENTIX_FULL_MATRIX_SKIP_CELLS = 'workspace-builds';

    const cells = resolveMatrixCells(FULL_TEST_MATRIX);

    expect(cells).toStrictEqual(expect.not.arrayContaining([
      expect.objectContaining({ id: 'workspace-builds' })
    ]));
    restoreEnv('JUMENTIX_FULL_MATRIX_SKIP_CELLS', previous);
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

  it('uses the default matrix and result file from the environment when options are omitted', () => {
    expect.assertions(2);
    const dir = matrixFs.mkdtempSync(
      matrixPath.join(require('node:os').tmpdir(), 'matrix-defaults-')
    );
    const resultFile = matrixPath.join(dir, 'matrix.json');
    const previousResultFile = process.env.JUMENTIX_CI_MATRIX_RESULT_FILE;
    const previousSkipCells = process.env.JUMENTIX_FULL_MATRIX_SKIP_CELLS;
    process.env.JUMENTIX_CI_MATRIX_RESULT_FILE = resultFile;
    delete process.env.JUMENTIX_FULL_MATRIX_SKIP_CELLS;

    try {
      const evidence = runFullTestMatrix({
        cells: [{ id: 'version', script: 'check-bun-version' }],
        execute: () => 0,
        logger: { log: jest.fn(), error: jest.fn() },
        availableScripts: fullMatrixRootPackage.scripts
      });

      expect(evidence.outcome).toBe('passed');
      expect(JSON.parse(matrixFs.readFileSync(resultFile, 'utf8')).outcome)
        .toBe('passed');
    } finally {
      restoreEnv('JUMENTIX_CI_MATRIX_RESULT_FILE', previousResultFile);
      restoreEnv('JUMENTIX_FULL_MATRIX_SKIP_CELLS', previousSkipCells);
      matrixFs.rmSync(dir, { recursive: true, force: true });
    }
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

  it('treats a negative exit status as a failure (JUM-681)', () => {
    expect.hasAssertions();

    // `spawnSync` reports a signal-terminated child as a negative status on
    // some platforms. It is an integer, so an `Number.isInteger` check alone
    // would carry it through as the cell's exit code — and a negative number is
    // not zero, but it is also not a status any reader would trust.
    const logger = { log: jest.fn(), error: jest.fn() };

    const evidence = runFullTestMatrix({
      cells: [{ id: 'signalled', script: 'lint' }],
      execute: () => -9,
      logger,
      availableScripts: fullMatrixRootPackage.scripts,
      env: {},
      resultFile: ''
    });

    expect(evidence.outcome).toBe('failed');
    expect(evidence.results[0].status).toBe(1);
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

/**
 * The manifest guard's refusals (JUM-681).
 *
 * The matrix is the list of everything that must pass before a promotion. A
 * malformed entry that slips through is a cell nobody runs and nobody misses —
 * the same false green as an unmapped suite, one level up.
 */
describe('full matrix manifest refusals (JUM-681)', () => {
  const scripts = { lint: 'eslint .', 'test:unit': 'bun test' };

  it('refuses an empty matrix', () => {
    expect.hasAssertions();

    expect(() => validateMatrixManifest([], scripts)).toThrow('at least one required cell');
    expect(() => validateMatrixManifest(null, scripts)).toThrow('at least one required cell');
  });

  it('refuses a cell with no id or no script', () => {
    expect.hasAssertions();

    expect(() => validateMatrixManifest([{ id: '', script: 'lint' }], scripts))
      .toThrow('non-empty id and script');
    expect(() => validateMatrixManifest([{ id: 'lint' }], scripts))
      .toThrow('non-empty id and script');
  });

  it('refuses a duplicate id and a duplicate script separately', () => {
    expect.hasAssertions();

    // Two names for one script is a cell that reports twice; two scripts under
    // one name is a cell that reports once for two things.
    expect(() => validateMatrixManifest([
      { id: 'lint', script: 'lint' },
      { id: 'lint', script: 'test:unit' }
    ], scripts)).toThrow('Duplicate full-matrix cell id: lint');

    expect(() => validateMatrixManifest([
      { id: 'lint', script: 'lint' },
      { id: 'lint-again', script: 'lint' }
    ], scripts)).toThrow('Duplicate full-matrix script: lint');
  });

  it('refuses a script that package.json does not define', () => {
    expect.hasAssertions();

    // The failure mode this prevents: a renamed script leaves a matrix cell
    // pointing at nothing, and `bun run missing` is not a test that ran.
    expect(() => validateMatrixManifest([{ id: 'gone', script: 'no:such:script' }], scripts))
      .toThrow('missing from package.json: no:such:script');
  });
});

/**
 * Skipping a cell, and the evidence file (JUM-681).
 *
 * `JUMENTIX_FULL_MATRIX_SKIP_CELLS` is how a promotion drops a cell that cannot
 * run in a given environment. An unnoticed typo there would silently skip
 * nothing — or worse, silently skip the wrong thing — and the matrix would
 * report a clean pass over a smaller list than the one it claims.
 */
describe('full matrix skip list and evidence (JUM-681)', () => {
  const cells = [
    { id: 'lint', script: 'lint' },
    { id: 'unit', script: 'test:unit' }
  ];

  it('runs everything when nothing is skipped', () => {
    expect.hasAssertions();

    expect(resolveMatrixCells(cells, {})).toStrictEqual(cells);
    expect(resolveMatrixCells(cells, { JUMENTIX_FULL_MATRIX_SKIP_CELLS: '   ' })).toStrictEqual(cells);
  });

  it('drops only the named cells, ignoring blanks and spacing', () => {
    expect.hasAssertions();

    const remaining = resolveMatrixCells(cells, {
      JUMENTIX_FULL_MATRIX_SKIP_CELLS: ' lint , '
    });

    expect(remaining).toStrictEqual([{ id: 'unit', script: 'test:unit' }]);
  });

  it('refuses a skip list that names a cell the matrix does not have', () => {
    expect.hasAssertions();

    // The failure this prevents: a typo skips nothing, the matrix runs the cell
    // anyway, and whoever wrote the list believes it was excluded.
    expect(() => resolveMatrixCells(cells, {
      JUMENTIX_FULL_MATRIX_SKIP_CELLS: 'lint,typo-cell'
    })).toThrow('unknown cell(s): typo-cell');
  });

  it('writes evidence only when a destination is given, creating its directory', () => {
    expect.hasAssertions();

    const root = matrixFs.mkdtempSync(matrixPath.join(require('os').tmpdir(), 'jum681-matrix-'));
    const target = matrixPath.join(root, 'nested', 'matrix.json');

    // No destination: nothing written, and no crash for the caller that does
    // not collect evidence.
    expect(writeMatrixEvidence({ outcome: 'passed' }, '')).toBeUndefined();

    writeMatrixEvidence({ outcome: 'passed', results: [] }, target);

    expect(JSON.parse(matrixFs.readFileSync(target, 'utf8'))).toStrictEqual({
      outcome: 'passed', results: []
    });

    matrixFs.rmSync(root, { recursive: true, force: true });
  });
});
