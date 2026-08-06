/* eslint-disable @typescript-eslint/no-var-requires */
const gateFs = require('fs');
const gatePath = require('path');
const {
  FULL_MATRIX_QUALITY_GATE,
  TASK_QUALITY_GATE,
  UNIT_QUALITY_GATE,
  resolvePullRequestFlag,
  resolveTargetBranch,
  runBranchQualityGate,
  selectQualityGate
} = require('../../../../../ci-cd/run-branch-quality-gate');

type GateStep = { id: string };

/**
 * An `execute` that fails one named step and passes the rest.
 *
 * Built here rather than inside a test so the branching lives outside the test
 * body (`jest/no-conditional-in-test`).
 */
function executeFailing(failingId: string) {
  const statuses: Record<string, number> = { [failingId]: 1 };
  return jest.fn((step: GateStep) => statuses[step.id] ?? 0);
}

/** An `execute` that throws on one named step and passes the rest. */
function executeCrashing(crashingId: string) {
  const behaviour: Record<string, () => number> = {
    [crashingId]: () => {
      throw new Error(`${crashingId} crashed`);
    }
  };
  const pass = () => 0;
  return jest.fn((step: GateStep) => (behaviour[step.id] ?? pass)());
}

const stepIds = (execute: { mock: { calls: Array<[GateStep]> } }) => execute
  .mock.calls.map(([step]) => step.id);

function restorePullRequestEnvFlag(previous: string | undefined) {
  if (previous === undefined) {
    delete process.env.AAA_CI_IS_PULL_REQUEST;
    return;
  }
  process.env.AAA_CI_IS_PULL_REQUEST = previous;
}

describe('run-branch-quality-gate', () => {
  it('defaults empty targets to dev and normalizes branch names', () => {
    expect.hasAssertions();
    expect(resolveTargetBranch('')).toBe('dev');
    expect(resolveTargetBranch(' MAIN ')).toBe('main');
    expect(resolveTargetBranch('dev')).toBe('dev');
  });

  it('selects the canonical unit gate for dev', () => {
    expect.hasAssertions();
    expect(selectQualityGate('dev', { isPullRequest: false })).toBe(UNIT_QUALITY_GATE);
  });

  it('selects the canonical full matrix for pull requests to dev', () => {
    expect.hasAssertions();
    expect(selectQualityGate('dev', { isPullRequest: true })).toBe(FULL_MATRIX_QUALITY_GATE);
  });

  it('selects the canonical full matrix for environment-marked pull requests to dev', () => {
    expect.hasAssertions();
    const previous = process.env.AAA_CI_IS_PULL_REQUEST;
    process.env.AAA_CI_IS_PULL_REQUEST = '1';
    try {
      expect(selectQualityGate('dev')).toBe(FULL_MATRIX_QUALITY_GATE);
    } finally {
      restorePullRequestEnvFlag(previous);
    }
  });

  it('selects the change-focused gate for task branches', () => {
    expect.hasAssertions();
    expect(selectQualityGate('codex/fix/149-example')).toBe(TASK_QUALITY_GATE);
  });

  it('selects the canonical full matrix for main', () => {
    expect.hasAssertions();
    expect(selectQualityGate('main')).toBe(FULL_MATRIX_QUALITY_GATE);
  });

  it('records target-aware evidence for task, dev, and main', () => {
    expect.hasAssertions();
    const execute = jest.fn().mockReturnValue(0);
    const logger = { log: jest.fn(), error: jest.fn() };
    const taskEvidence = runBranchQualityGate({
      targetBranch: 'codex/ci/191-example', isPullRequest: false, execute, logger, resultFile: ''
    });
    const devEvidence = runBranchQualityGate({
      targetBranch: 'dev', isPullRequest: false, execute, logger, resultFile: ''
    });
    const mainEvidence = runBranchQualityGate({
      targetBranch: 'main', isPullRequest: false, execute, logger, resultFile: ''
    });
    const devPrEvidence = runBranchQualityGate({
      targetBranch: 'dev', isPullRequest: true, execute, logger, resultFile: ''
    });

    // Lint runs ahead of the two gates that do not contain it, and not ahead of
    // the strict matrix, which declares it as its first cell (JUM-596).
    expect(stepIds(execute)).toStrictEqual([
      'lint', 'task-changes',
      'lint', 'unit',
      'full-matrix',
      'full-matrix'
    ]);
    const lintPassed = [{ id: 'lint', script: 'lint', status: 0 }];
    expect(taskEvidence).toStrictEqual({
      schemaVersion: 2,
      targetBranch: 'codex/ci/191-example',
      isPullRequest: false,
      gate: 'task-changes',
      script: 'ci:gate:task',
      preflight: lintPassed,
      outcome: 'passed',
      status: 0
    });
    expect(devEvidence).toStrictEqual({
      schemaVersion: 2,
      targetBranch: 'dev',
      isPullRequest: false,
      gate: 'unit',
      script: 'test:unit',
      preflight: lintPassed,
      outcome: 'passed',
      status: 0
    });
    expect(mainEvidence).toStrictEqual({
      schemaVersion: 2,
      targetBranch: 'main',
      isPullRequest: false,
      gate: 'full-matrix',
      script: 'ci:gate:strict',
      preflight: [],
      outcome: 'passed',
      status: 0
    });
    expect(devPrEvidence).toStrictEqual({
      schemaVersion: 2,
      targetBranch: 'dev',
      isPullRequest: true,
      gate: 'full-matrix',
      script: 'ci:gate:strict',
      preflight: [],
      outcome: 'passed',
      status: 0
    });
  });

  it('resolves explicit pull request flags', () => {
    expect.hasAssertions();
    expect(resolvePullRequestFlag('true')).toBe(true);
    expect(resolvePullRequestFlag('1')).toBe(true);
    expect(resolvePullRequestFlag('false')).toBe(false);
    expect(resolvePullRequestFlag('0')).toBe(false);
  });

  it('fails closed for invalid execution outcomes and writes evidence', () => {
    expect.hasAssertions();
    const resultFile = gatePath.join(__dirname, '.tmp-branch-gate-evidence.json');
    const logger = { log: jest.fn(), error: jest.fn() };
    const evidence = runBranchQualityGate({
      targetBranch: 'main',
      execute: () => null,
      logger,
      resultFile
    });

    expect(evidence.outcome).toBe('failed');
    expect(evidence.status).toBe(1);
    expect(JSON.parse(gateFs.readFileSync(resultFile, 'utf8'))).toStrictEqual(evidence);
    gateFs.unlinkSync(resultFile);
  });

  it('fails closed when the selected gate crashes', () => {
    expect.hasAssertions();
    const logger = { log: jest.fn(), error: jest.fn() };
    const evidence = runBranchQualityGate({
      targetBranch: 'main',
      execute: () => {
        throw new Error('deliberate failure');
      },
      logger,
      resultFile: ''
    });

    expect(evidence.outcome).toBe('failed');
    expect(logger.error).toHaveBeenCalledTimes(2);
  });

  /**
   * JUM-596. Lint used to run on `main` and on pull requests into `dev`, and
   * nowhere else — so a task branch and a direct push to `dev` were both
   * unlinted. That is how twenty lint errors reached `dev`.
   */
  it('runs lint ahead of the gates that do not already contain it', () => {
    expect.hasAssertions();
    expect(TASK_QUALITY_GATE.preflight).toStrictEqual([{ id: 'lint', script: 'lint' }]);
    expect(UNIT_QUALITY_GATE.preflight).toStrictEqual([{ id: 'lint', script: 'lint' }]);
    // The strict matrix declares lint as a cell; a second run costs minutes to
    // learn the same thing.
    expect(FULL_MATRIX_QUALITY_GATE.preflight).toStrictEqual([]);
  });

  it('does not run the suites when lint fails', () => {
    expect.hasAssertions();
    const logger = { log: jest.fn(), error: jest.fn() };
    const execute = executeFailing('lint');

    const evidence = runBranchQualityGate({
      targetBranch: 'claude/fix/JUM-596-example',
      isPullRequest: false,
      execute,
      logger,
      resultFile: ''
    });

    // A gate that ran the whole suite anyway would report the lint failure
    // twenty minutes later, or bury it under the test output.
    expect(stepIds(execute)).toStrictEqual(['lint']);
    expect(evidence.outcome).toBe('failed');
    expect(evidence.status).toBe(1);
  });

  it('records the preflight result, so a skipped lint cannot read as a passed one', () => {
    expect.hasAssertions();
    const logger = { log: jest.fn(), error: jest.fn() };
    const evidence = runBranchQualityGate({
      targetBranch: 'claude/fix/JUM-596-example',
      isPullRequest: false,
      execute: executeFailing('lint'),
      logger,
      resultFile: ''
    });

    expect(evidence.preflight).toStrictEqual([{ id: 'lint', script: 'lint', status: 1 }]);
  });

  it('fails closed when lint itself crashes', () => {
    expect.hasAssertions();
    const logger = { log: jest.fn(), error: jest.fn() };
    const execute = executeCrashing('lint');

    const evidence = runBranchQualityGate({
      targetBranch: 'claude/fix/JUM-596-example',
      isPullRequest: false,
      execute,
      logger,
      resultFile: ''
    });

    expect(evidence.outcome).toBe('failed');
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
