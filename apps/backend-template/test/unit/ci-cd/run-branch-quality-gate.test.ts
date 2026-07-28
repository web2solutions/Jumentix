/* eslint-disable @typescript-eslint/no-var-requires */
const gateFs = require('fs');
const gatePath = require('path');
const {
  FULL_MATRIX_QUALITY_GATE,
<<<<<<< HEAD
=======
  TASK_QUALITY_GATE,
  UNIT_QUALITY_GATE,
>>>>>>> origin/dev
  resolveTargetBranch,
  runBranchQualityGate,
  selectQualityGate
} = require('../../../../../ci-cd/run-branch-quality-gate');

describe('run-branch-quality-gate', () => {
  it('defaults empty targets to dev and normalizes branch names', () => {
    expect.hasAssertions();
    expect(resolveTargetBranch('')).toBe('dev');
    expect(resolveTargetBranch(' MAIN ')).toBe('main');
    expect(resolveTargetBranch('dev')).toBe('dev');
  });

<<<<<<< HEAD
  it('selects the canonical full matrix for dev', () => {
    expect.hasAssertions();
    expect(selectQualityGate('dev')).toBe(FULL_MATRIX_QUALITY_GATE);
  });

  it('selects the canonical full matrix for task branches', () => {
=======
  it('selects the canonical unit gate for dev', () => {
    expect.hasAssertions();
    expect(selectQualityGate('dev')).toBe(UNIT_QUALITY_GATE);
  });

  it('selects the change-focused gate for task branches', () => {
>>>>>>> origin/dev
    expect.hasAssertions();
    expect(selectQualityGate('codex/fix/149-example')).toBe(FULL_MATRIX_QUALITY_GATE);
  });

  it('selects the canonical full matrix for main', () => {
    expect.hasAssertions();
    expect(selectQualityGate('main')).toBe(FULL_MATRIX_QUALITY_GATE);
  });

<<<<<<< HEAD
  it('records successful full-matrix evidence for dev and main', () => {
=======
  it('records target-aware evidence for task, dev, and main', () => {
>>>>>>> origin/dev
    expect.hasAssertions();
    const execute = jest.fn().mockReturnValue(0);
    const logger = { log: jest.fn(), error: jest.fn() };
    const taskEvidence = runBranchQualityGate({
      targetBranch: 'codex/ci/191-example', execute, logger, resultFile: ''
    });
    const devEvidence = runBranchQualityGate({
      targetBranch: 'dev', execute, logger, resultFile: ''
    });
    const mainEvidence = runBranchQualityGate({
      targetBranch: 'main', execute, logger, resultFile: ''
    });

    expect(execute.mock.calls).toStrictEqual([
<<<<<<< HEAD
      [FULL_MATRIX_QUALITY_GATE],
      [FULL_MATRIX_QUALITY_GATE]
    ]);
=======
      [TASK_QUALITY_GATE],
      [UNIT_QUALITY_GATE],
      [FULL_MATRIX_QUALITY_GATE]
    ]);
    expect(taskEvidence).toStrictEqual({
      schemaVersion: 1,
      targetBranch: 'codex/ci/191-example',
      gate: 'task-changes',
      script: 'ci:gate:task',
      outcome: 'passed',
      status: 0
    });
>>>>>>> origin/dev
    expect(devEvidence).toStrictEqual({
      schemaVersion: 1,
      targetBranch: 'dev',
      gate: 'full-matrix',
      script: 'ci:gate:strict',
      outcome: 'passed',
      status: 0
    });
    expect(mainEvidence).toStrictEqual({
      schemaVersion: 1,
      targetBranch: 'main',
      gate: 'full-matrix',
      script: 'ci:gate:strict',
      outcome: 'passed',
      status: 0
    });
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
