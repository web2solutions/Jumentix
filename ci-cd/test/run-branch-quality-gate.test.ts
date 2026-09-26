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
} = require('../run-branch-quality-gate');

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

function runLocalBranchQualityGate(options: Record<string, unknown>) {
  return runBranchQualityGate({
    ...options,
    env: {},
    useCiContext: false
  });
}

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

  it('selects the change-focused gate for pull requests to dev', () => {
    expect.hasAssertions();
    expect(selectQualityGate('dev', { isPullRequest: true })).toBe(TASK_QUALITY_GATE);
  });

  it('selects the change-focused gate for environment-marked pull requests to dev', () => {
    expect.hasAssertions();
    const previous = process.env.AAA_CI_IS_PULL_REQUEST;
    process.env.AAA_CI_IS_PULL_REQUEST = '1';
    try {
      expect(selectQualityGate('dev')).toBe(TASK_QUALITY_GATE);
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
    const taskEvidence = runLocalBranchQualityGate({
      targetBranch: 'codex/ci/191-example', isPullRequest: false, execute, logger, resultFile: ''
    });
    const devEvidence = runLocalBranchQualityGate({
      targetBranch: 'dev', isPullRequest: false, execute, logger, resultFile: ''
    });
    const mainEvidence = runLocalBranchQualityGate({
      targetBranch: 'main', isPullRequest: false, execute, logger, resultFile: ''
    });
    const devPrEvidence = runLocalBranchQualityGate({
      targetBranch: 'dev', isPullRequest: true, execute, logger, resultFile: ''
    });

    // Lint runs ahead of the two gates that do not contain it, and not ahead of
    // the strict matrix, which declares it as its first cell (JUM-596). Test
    // integrity, workspace boundaries, and build:dev run ahead of all three,
    // including the strict matrix path used by release/main (JUM-683 / JUM-786).
    expect(stepIds(execute)).toStrictEqual([
      'lint', 'test-integrity', 'current-governance-docs', 'documentation-audience', 'workspace-boundaries', 'ownership-placement', 'build-dev', 'task-changes',
      'lint', 'test-integrity', 'current-governance-docs', 'documentation-audience', 'workspace-boundaries', 'ownership-placement', 'build-dev', 'unit',
      'test-integrity', 'current-governance-docs', 'documentation-audience', 'workspace-boundaries', 'ownership-placement', 'build-dev', 'full-matrix',
      'lint', 'test-integrity', 'current-governance-docs', 'documentation-audience', 'workspace-boundaries', 'ownership-placement', 'build-dev', 'task-changes'
    ]);
    const lintPassed = [
      { id: 'lint', script: 'lint', status: 0 },
      { id: 'test-integrity', script: 'test:integrity', status: 0 },
      { id: 'current-governance-docs', script: 'docs:check-current-governance', status: 0 },
      { id: 'documentation-audience', script: 'docs:check-audience', status: 0 },
      { id: 'workspace-boundaries', script: 'arch:check-workspace-boundaries', status: 0 },
      { id: 'ownership-placement', script: 'arch:check-ownership-placement', status: 0 },
      { id: 'build-dev', script: 'build:dev', status: 0 }
    ];
    const integrityOnlyPassed = [
      { id: 'test-integrity', script: 'test:integrity', status: 0 },
      { id: 'current-governance-docs', script: 'docs:check-current-governance', status: 0 },
      { id: 'documentation-audience', script: 'docs:check-audience', status: 0 },
      { id: 'workspace-boundaries', script: 'arch:check-workspace-boundaries', status: 0 },
      { id: 'ownership-placement', script: 'arch:check-ownership-placement', status: 0 },
      { id: 'build-dev', script: 'build:dev', status: 0 }
    ];
    expect(taskEvidence).toStrictEqual({
      schemaVersion: 2,
      targetBranch: 'codex/ci/191-example',
      isPullRequest: false,
      context: null,
      selectedJobs: null,
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
      context: null,
      selectedJobs: null,
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
      context: null,
      selectedJobs: null,
      gate: 'full-matrix',
      script: 'ci:gate:strict',
      preflight: integrityOnlyPassed,
      outcome: 'passed',
      status: 0
    });
    expect(devPrEvidence).toStrictEqual({
      schemaVersion: 2,
      targetBranch: 'dev',
      isPullRequest: true,
      context: null,
      selectedJobs: null,
      gate: 'task-changes',
      script: 'ci:gate:task',
      preflight: lintPassed,
      outcome: 'passed',
      status: 0
    });
  });

  it('selects the full matrix only for release promotions, main, and scheduled full contexts', () => {
    expect.hasAssertions();
    expect([
      selectQualityGate('dev', { context: 'task-pr-to-dev' }),
      selectQualityGate('dev', { context: 'task-branch-push' }),
      selectQualityGate('dev', { context: 'dev-push' }),
      selectQualityGate('main', { context: 'release-pr-to-main' }),
      selectQualityGate('main', { context: 'main-push' }),
      selectQualityGate('main', { context: 'scheduled-full' })
    ]).toStrictEqual([
      TASK_QUALITY_GATE,
      TASK_QUALITY_GATE,
      UNIT_QUALITY_GATE,
      FULL_MATRIX_QUALITY_GATE,
      FULL_MATRIX_QUALITY_GATE,
      FULL_MATRIX_QUALITY_GATE
    ]);
  });

  it('selects the generated-automation gate for app-release and changelog heads', () => {
    expect.hasAssertions();
    const {
      GENERATED_AUTOMATION_QUALITY_GATE: generatedGate
    } = require('../run-branch-quality-gate');
    expect(selectQualityGate('main', {
      context: 'release-pr-to-main',
      headRef: 'chore/release-v0.2.15'
    })).toBe(generatedGate);
    expect(selectQualityGate('main', {
      context: 'release-pr-to-main',
      headRef: 'chore/changelog-sync-deadbeef'
    })).toBe(generatedGate);
  });

  it('runs only preflight plus the generated-automation script for release heads', () => {
    expect.hasAssertions();
    const execute = jest.fn().mockReturnValue(0);
    const evidence = runBranchQualityGate({
      env: {
        CIRCLE_BRANCH: 'chore/release-v0.2.15',
        CIRCLE_PULL_REQUEST: 'https://github.com/web2solutions/Jumentix/pull/514',
        CIRCLE_PR_BASE_BRANCH: 'main'
      },
      spawn: jest.fn().mockReturnValue({
        status: 0,
        stdout: [
          'package.json',
          'release-policy.json',
          'apps/frontend/package.json'
        ].join('\n')
      }),
      execute,
      logger: { log: jest.fn(), error: jest.fn() },
      resultFile: ''
    });

    expect(evidence).toMatchObject({
      targetBranch: 'main',
      isPullRequest: true,
      context: 'release-pr-to-main',
      gate: 'generated-automation',
      script: 'ci:gate:generated-automation',
      outcome: 'passed'
    });
    expect(stepIds(execute)).toStrictEqual([
      'lint',
      'test-integrity',
      'current-governance-docs',
      'documentation-audience',
      'workspace-boundaries',
      'ownership-placement',
      'build-dev',
      'generated-automation'
    ]);
  });

  it('records CI context evidence when CircleCI metadata is available', () => {
    expect.hasAssertions();
    const execute = jest.fn().mockReturnValue(0);
    const evidence = runBranchQualityGate({
      env: {
        CIRCLE_BRANCH: 'codex/feature/JUM-631-fast-ci',
        CIRCLE_PULL_REQUEST: 'https://github.com/web2solutions/Jumentix/pull/200',
        CIRCLE_PR_BASE_BRANCH: 'dev'
      },
      spawn: jest.fn().mockReturnValue({ status: 0, stdout: 'ci-cd/run-branch-quality-gate.js\n' }),
      execute,
      logger: { log: jest.fn(), error: jest.fn() },
      resultFile: ''
    });

    expect(evidence).toMatchObject({
      targetBranch: 'dev',
      isPullRequest: true,
      context: 'task-pr-to-dev',
      selectedJobs: ['branch-gate', 'third-party-review', 'browser-matrix'],
      gate: 'task-changes',
      script: 'ci:gate:task'
    });
    expect(stepIds(execute)).toStrictEqual([
      'lint', 'test-integrity', 'current-governance-docs', 'documentation-audience', 'workspace-boundaries', 'ownership-placement', 'build-dev', 'task-changes'
    ]);
  });

  it('fails closed when CI pull request context is incomplete', () => {
    expect.hasAssertions();
    const execute = jest.fn().mockReturnValue(0);
    const evidence = runBranchQualityGate({
      env: {
        CIRCLE_BRANCH: 'codex/feature/JUM-631-fast-ci',
        CIRCLE_PULL_REQUEST: 'https://github.com/web2solutions/Jumentix/pull/200'
      },
      execute,
      logger: { log: jest.fn(), error: jest.fn() },
      resultFile: ''
    });

    expect(evidence).toMatchObject({
      gate: 'context-classification',
      script: 'classify-ci-context',
      outcome: 'failed',
      status: 1,
      error: '[ci-context] pull request context is missing the base branch'
    });
    expect(execute).not.toHaveBeenCalled();
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
    const evidence = runLocalBranchQualityGate({
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
    const evidence = runLocalBranchQualityGate({
      targetBranch: 'main',
      execute: () => {
        throw new Error('deliberate failure');
      },
      logger,
      resultFile: ''
    });

    expect(evidence.outcome).toBe('failed');
    // One line for the crashed preflight, one for the crashed gate, one for the
    // gate's own summary: a crash anywhere is reported everywhere it is known.
    expect(logger.error).toHaveBeenCalledTimes(3);
  });

  /**
   * JUM-596. Lint used to run on `main` and on pull requests into `dev`, and
   * nowhere else — so a task branch and a direct push to `dev` were both
   * unlinted. That is how twenty lint errors reached `dev`.
   */
  it('runs lint, integrity, workspace boundaries, and build:dev ahead of cheap gates (JUM-786)', () => {
    expect.hasAssertions();
    const integrity = { id: 'test-integrity', script: 'test:integrity' };
    const currentGovernanceDocs = {
      id: 'current-governance-docs',
      script: 'docs:check-current-governance'
    };
    const documentationAudience = { id: 'documentation-audience', script: 'docs:check-audience' };
    const workspaceBoundaries = {
      id: 'workspace-boundaries',
      script: 'arch:check-workspace-boundaries'
    };
    const ownershipPlacement = {
      id: 'ownership-placement',
      script: 'arch:check-ownership-placement'
    };
    const buildDev = { id: 'build-dev', script: 'build:dev' };

    expect(TASK_QUALITY_GATE.preflight).toStrictEqual([
      { id: 'lint', script: 'lint' },
      integrity,
      currentGovernanceDocs,
      documentationAudience,
      workspaceBoundaries,
      ownershipPlacement,
      buildDev
    ]);
    expect(UNIT_QUALITY_GATE.preflight).toStrictEqual([
      { id: 'lint', script: 'lint' },
      integrity,
      currentGovernanceDocs,
      documentationAudience,
      workspaceBoundaries,
      ownershipPlacement,
      buildDev
    ]);
    // The strict matrix declares lint as a cell; a second run costs minutes to
    // learn the same thing. It already cells architecture-workspaces +
    // backend-build, but task/dev CI never selects that matrix — so those two
    // also preflight here (JUM-786) alongside test integrity (JUM-683).
    expect(FULL_MATRIX_QUALITY_GATE.preflight).toStrictEqual([
      integrity,
      currentGovernanceDocs,
      documentationAudience,
      workspaceBoundaries,
      ownershipPlacement,
      buildDev
    ]);
  });

  it('does not run the suites when lint fails', () => {
    expect.hasAssertions();
    const logger = { log: jest.fn(), error: jest.fn() };
    const execute = executeFailing('lint');

    const evidence = runLocalBranchQualityGate({
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
    const evidence = runLocalBranchQualityGate({
      targetBranch: 'claude/fix/JUM-596-example',
      isPullRequest: false,
      execute: executeFailing('lint'),
      logger,
      resultFile: ''
    });

    // Lint failed, so the integrity preflight behind it never ran — and the
    // evidence says so rather than listing it as passed.
    expect(evidence.preflight).toStrictEqual([{ id: 'lint', script: 'lint', status: 1 }]);
  });

  it('fails closed when lint itself crashes', () => {
    expect.hasAssertions();
    const logger = { log: jest.fn(), error: jest.fn() };
    const execute = executeCrashing('lint');

    const evidence = runLocalBranchQualityGate({
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
