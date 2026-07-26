/* eslint-disable @typescript-eslint/no-var-requires */
const taskFs = require('fs');
const taskPath = require('path');
const {
  createTaskTestPlan,
  normalizeFiles,
  readChangedFiles,
  runTaskChangeTests
} = require('../../../../../ci-cd/run-task-change-tests');

describe('run-task-change-tests', () => {
  it('normalizes unique changed file paths', () => {
    expect(normalizeFiles(['apps\\backend-template\\src\\a.ts', 'apps/backend-template/src/a.ts', '']))
      .toStrictEqual(['apps/backend-template/src/a.ts']);
  });

  it('reads staged and range diffs using explicit git commands', () => {
    const spawn = jest.fn().mockReturnValue({ status: 0, stdout: 'a.ts\nb.ts\n' });

    expect(readChangedFiles({ mode: 'staged', spawn })).toStrictEqual(['a.ts', 'b.ts']);
    expect(readChangedFiles({ mode: 'range', baseRef: 'origin/dev', spawn })).toStrictEqual(['a.ts', 'b.ts']);
    expect(spawn.mock.calls[0][1]).toContain('--cached');
    expect(spawn.mock.calls[1][1]).toContain('origin/dev...HEAD');
  });

  it('fails when git cannot provide changed files', () => {
    expect(() => readChangedFiles({ spawn: () => ({ status: 1 }) }))
      .toThrow('Unable to read changed files');
  });

  it('runs only changed unit tests when they are present', () => {
    expect(createTaskTestPlan([
      'apps/backend-template/src/example.ts',
      'apps/backend-template/test/unit/example.test.ts'
    ])).toStrictEqual({
      type: 'changed-unit-tests',
      files: ['apps/backend-template/test/unit/example.test.ts']
    });
  });

  it('finds tests related to changed implementation files', () => {
    expect(createTaskTestPlan(['ci-cd/run-task-change-tests.js'])).toStrictEqual({
      type: 'related-unit-tests',
      files: ['ci-cd/run-task-change-tests.js']
    });
  });

  it('does not run unrelated tests for docs-only changes', () => {
    expect(createTaskTestPlan(['documentation/md/TESTING-CI-AND-QUALITY.md'])).toStrictEqual({
      type: 'not-applicable',
      files: []
    });
  });

  it('records success, failure, crash, and not-applicable evidence', () => {
    const logger = { log: jest.fn(), error: jest.fn() };
    const successful = runTaskChangeTests({
      files: ['apps/backend-template/test/unit/example.test.ts'],
      execute: jest.fn().mockReturnValue(0),
      logger,
      resultFile: ''
    });
    const failed = runTaskChangeTests({
      files: ['ci-cd/example.js'],
      execute: () => 3,
      logger,
      resultFile: ''
    });
    const crashed = runTaskChangeTests({
      files: ['ci-cd/example.js'],
      execute: () => { throw new Error('deliberate failure'); },
      logger,
      resultFile: ''
    });
    const skipped = runTaskChangeTests({
      files: ['README.md'],
      execute: () => 99,
      logger,
      resultFile: ''
    });

    expect(successful.outcome).toBe('passed');
    expect(failed.outcome).toBe('failed');
    expect(crashed.outcome).toBe('failed');
    expect(skipped).toMatchObject({ plan: 'not-applicable', outcome: 'passed', status: 0 });
    expect(logger.error).toHaveBeenCalledTimes(2);
  });

  it('writes JSON evidence for the selected change-focused test plan', () => {
    const resultFile = taskPath.join(__dirname, '.tmp-task-change-evidence.json');
    const evidence = runTaskChangeTests({
      files: ['apps/backend-template/test/unit/example.test.ts'],
      execute: () => 0,
      logger: { log: jest.fn(), error: jest.fn() },
      resultFile
    });

    expect(JSON.parse(taskFs.readFileSync(resultFile, 'utf8'))).toStrictEqual(evidence);
    taskFs.unlinkSync(resultFile);
  });
});
