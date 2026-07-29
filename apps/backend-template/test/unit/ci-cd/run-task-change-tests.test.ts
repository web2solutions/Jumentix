/* eslint-disable @typescript-eslint/no-var-requires */
const taskFs = require('fs');
const taskPath = require('path');
const {
  createTaskTestPlan,
  normalizeFiles,
  readChangedFiles,
  runTaskChangeTests,
  validateDocumentationFiles
} = require('../../../../../ci-cd/run-task-change-tests');

describe('run-task-change-tests', () => {
  it('normalizes unique changed file paths', () => {
    expect.hasAssertions();
    expect(normalizeFiles(['apps\\backend-template\\src\\a.ts', 'apps/backend-template/src/a.ts', '']))
      .toStrictEqual(['apps/backend-template/src/a.ts']);
  });

  it('reads staged and range diffs using explicit git commands', () => {
    expect.hasAssertions();
    const spawn = jest.fn().mockReturnValue({ status: 0, stdout: 'a.ts\nb.ts\n' });

    expect(readChangedFiles({ mode: 'staged', spawn })).toStrictEqual(['a.ts', 'b.ts']);
    expect(readChangedFiles({ mode: 'range', baseRef: 'origin/dev', spawn })).toStrictEqual(['a.ts', 'b.ts']);
    expect(spawn.mock.calls[0][1]).toContain('--cached');
    expect(spawn.mock.calls[1][1]).toContain('origin/dev...HEAD');
  });

  it('fails when git cannot provide changed files', () => {
    expect.hasAssertions();
    expect(() => readChangedFiles({ spawn: () => ({ status: 1 }) }))
      .toThrow('Unable to read changed files');
  });

  it('runs only changed unit tests when they are present', () => {
    expect.hasAssertions();
    expect(createTaskTestPlan([
      'apps/backend-template/src/example.ts',
      'apps/backend-template/test/unit/example.test.ts'
    ])).toStrictEqual({
      type: 'changed-unit-tests',
      files: ['apps/backend-template/test/unit/example.test.ts']
    });
  });

  it('finds tests related to changed implementation files', () => {
    expect.hasAssertions();
    expect(createTaskTestPlan(['ci-cd/run-task-change-tests.js'])).toStrictEqual({
      type: 'related-unit-tests',
      files: ['ci-cd/run-task-change-tests.js']
    });
  });

  it('runs changed integration and planner tests with Restify timeout headroom', () => {
    expect.hasAssertions();
    expect(createTaskTestPlan([
      'apps/backend-template/test/helpers/listenForSupertest.ts',
      'apps/backend-template/test/integration/Fastify/auth/login.test.ts',
      'apps/backend-template/test/integration/Restify/auth/login.test.ts',
      'apps/backend-template/test/unit/ci-cd/run-task-change-tests.test.ts'
    ])).toStrictEqual({
      type: 'changed-integration-tests',
      files: [
        'apps/backend-template/test/unit/ci-cd/run-task-change-tests.test.ts',
        'apps/backend-template/test/integration/Fastify/auth/login.test.ts',
        'apps/backend-template/test/integration/Restify/auth/login.test.ts'
      ],
      testTimeoutMs: 15000
    });
  });

  it('selects website-native gates and preserves other related test inputs', () => {
    expect.hasAssertions();
    expect(createTaskTestPlan([
      'apps/jumentix-website/app/page.tsx',
      'apps/jumentix-website/scripts/prepublish-site-checks.mjs',
      'ci-cd/run-task-change-tests.js',
      'apps/backend-template/test/unit/ci-cd/run-task-change-tests.test.ts'
    ])).toStrictEqual({
      type: 'website-quality-gate',
      files: [
        'apps/jumentix-website/app/page.tsx',
        'apps/jumentix-website/scripts/prepublish-site-checks.mjs'
      ],
      unitTests: ['apps/backend-template/test/unit/ci-cd/run-task-change-tests.test.ts'],
      relatedFiles: ['ci-cd/run-task-change-tests.js']
    });
  });

  it('maps workflow and hook changes to their governance unit test', () => {
    expect.hasAssertions();
    expect(createTaskTestPlan([
      '.github/workflows/test.yml',
      '.circleci/config.yml',
      '.husky/pre-push'
    ])).toStrictEqual({
      type: 'mapped-unit-tests',
      files: ['apps/backend-template/test/unit/ci-cd/run-full-test-matrix.test.ts']
    });
  });

  it('selects real documentation validation for docs-only changes', () => {
    expect.hasAssertions();
    expect(createTaskTestPlan(['documentation/md/TESTING-CI-AND-QUALITY.md'])).toStrictEqual({
      type: 'documentation-validation',
      files: ['documentation/md/TESTING-CI-AND-QUALITY.md']
    });
  });

  it('fails closed for an unsupported or empty change set', () => {
    expect.hasAssertions();
    expect(createTaskTestPlan([])).toStrictEqual({
      type: 'unsupported-change-set',
      files: []
    });
  });

  it('validates documentation content and conflict markers', () => {
    expect.hasAssertions();
    const rootDir = taskFs.mkdtempSync(taskPath.join(require('os').tmpdir(), 'task-docs-'));
    taskFs.writeFileSync(taskPath.join(rootDir, 'valid.md'), '# Valid\n');
    taskFs.writeFileSync(taskPath.join(rootDir, 'conflict.md'), '<<<<<<< HEAD\n');
    expect(validateDocumentationFiles(['valid.md'], rootDir)).toBe(0);
    expect(validateDocumentationFiles(['missing.md'], rootDir)).toBe(1);
    expect(validateDocumentationFiles(['conflict.md'], rootDir)).toBe(1);
    taskFs.rmSync(rootDir, { recursive: true, force: true });
  });

  it('records success, failure, crash, and documentation not-applicable evidence', () => {
    expect.hasAssertions();
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
    const documentation = runTaskChangeTests({
      files: ['README.md'],
      execute: () => 0,
      logger,
      resultFile: ''
    });

    expect(successful.outcome).toBe('passed');
    expect(failed.outcome).toBe('failed');
    expect(crashed.outcome).toBe('failed');
    expect(documentation).toMatchObject({
      plan: 'documentation-validation', outcome: 'not-applicable', status: 0
    });
    expect(logger.error).toHaveBeenCalledTimes(2);
  });

  it('keeps Storybook outside the global task-change executor', () => {
    expect.hasAssertions();
    const source = taskFs.readFileSync(
      taskPath.join(__dirname, '../../../../../ci-cd/run-task-change-tests.js'),
      'utf8'
    );

    expect(source).not.toContain('\'storybook:build\'');
    expect(source).not.toContain('\'storybook:smoke\'');
    expect(source).toContain('\'test:prepublish\'');
  });

  it('writes JSON evidence for the selected change-focused test plan', () => {
    expect.hasAssertions();
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
