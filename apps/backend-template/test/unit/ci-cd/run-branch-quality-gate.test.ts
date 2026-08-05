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

    expect(execute.mock.calls).toStrictEqual([
      [TASK_QUALITY_GATE],
      [UNIT_QUALITY_GATE],
      [FULL_MATRIX_QUALITY_GATE],
      [FULL_MATRIX_QUALITY_GATE]
    ]);
    expect(taskEvidence).toStrictEqual({
      schemaVersion: 1,
      targetBranch: 'codex/ci/191-example',
      isPullRequest: false,
      gate: 'task-changes',
      script: 'ci:gate:task',
      outcome: 'passed',
      status: 0
    });
    expect(devEvidence).toStrictEqual({
      schemaVersion: 1,
      targetBranch: 'dev',
      isPullRequest: false,
      gate: 'unit',
      script: 'test:unit',
      outcome: 'passed',
      status: 0
    });
    expect(mainEvidence).toStrictEqual({
      schemaVersion: 1,
      targetBranch: 'main',
      isPullRequest: false,
      gate: 'full-matrix',
      script: 'ci:gate:strict',
      outcome: 'passed',
      status: 0
    });
    expect(devPrEvidence).toStrictEqual({
      schemaVersion: 1,
      targetBranch: 'dev',
      isPullRequest: true,
      gate: 'full-matrix',
      script: 'ci:gate:strict',
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
      execute: () => {
        throw new Error('deliberate failure');
      },
      logger,
      resultFile: ''
    });

    expect(evidence.outcome).toBe('failed');
    expect(logger.error).toHaveBeenCalledTimes(2);
  });
});
