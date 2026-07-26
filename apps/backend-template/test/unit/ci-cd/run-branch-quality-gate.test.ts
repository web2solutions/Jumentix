/* eslint-disable @typescript-eslint/no-var-requires */
const gateFs = require('fs');
const gatePath = require('path');
const {
  DEV_QUALITY_GATE,
  MAIN_QUALITY_GATE,
  TASK_QUALITY_GATE,
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

  it('selects all unit tests for dev', () => {
    expect.hasAssertions();
    expect(selectQualityGate('dev')).toBe(DEV_QUALITY_GATE);
  });

  it('selects change-focused tests for task branches', () => {
    expect.hasAssertions();
    expect(selectQualityGate('codex/fix/149-example')).toBe(TASK_QUALITY_GATE);
  });

  it('selects the full matrix exclusively for main', () => {
    expect.hasAssertions();
    expect(selectQualityGate('main')).toBe(MAIN_QUALITY_GATE);
  });

  it('records successful unit and main quality-gate evidence', () => {
    expect.hasAssertions();
    const execute = jest.fn().mockReturnValue(0);
    const logger = { log: jest.fn(), error: jest.fn() };
    const devEvidence = runBranchQualityGate({ targetBranch: 'dev', execute, logger, resultFile: '' });
    const mainEvidence = runBranchQualityGate({ targetBranch: 'main', execute, logger, resultFile: '' });

    expect(execute.mock.calls).toStrictEqual([[DEV_QUALITY_GATE], [MAIN_QUALITY_GATE]]);
    expect(devEvidence).toStrictEqual({
      schemaVersion: 1,
      targetBranch: 'dev',
      gate: 'unit',
      script: 'test:unit',
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
