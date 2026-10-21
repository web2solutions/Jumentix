/* eslint-disable @typescript-eslint/no-var-requires */
const {
  CONTEXTS,
  FULL_JOBS,
  classifyCiContext,
  jobSelected,
  pullRequestJobsForHead,
  runCli,
  selectedJobsFor
} = require('../classify-ci-context');

const spawn = jest.fn().mockReturnValue({ status: 0, stdout: 'ci-cd/a.js\nREADME.md\n' });

function classify(env: Record<string, string>) {
  return classifyCiContext({ env, spawn });
}

describe('classify-ci-context', () => {
  beforeEach(() => {
    spawn.mockClear();
  });

  it('classifies a task branch push as branch-gate only', () => {
    expect.hasAssertions();

    const evidence = classify({ CIRCLE_BRANCH: 'codex/feature/JUM-631-fast-ci' });

    expect(evidence).toMatchObject({
      context: CONTEXTS.TASK_BRANCH_PUSH,
      isPullRequest: false,
      headRef: 'codex/feature/JUM-631-fast-ci',
      baseRef: 'origin/dev',
      selectedJobs: ['branch-gate'],
      changedFiles: ['ci-cd/a.js', 'README.md']
    });
  });

  it('classifies a task PR to dev as branch-gate, third-party-review, browser-matrix, and coverage', () => {
    expect.hasAssertions();

    const evidence = classify({
      CIRCLE_BRANCH: 'codex/feature/JUM-631-fast-ci',
      CIRCLE_PULL_REQUEST: 'https://github.com/web2solutions/Jumentix/pull/200',
      CIRCLE_PR_BASE_BRANCH: 'dev'
    });

    expect(evidence.context).toBe(CONTEXTS.TASK_PR_TO_DEV);
    expect(evidence.selectedJobs).toStrictEqual([
      'branch-gate', 'third-party-review', 'browser-matrix', 'coverage'
    ]);
  });

  it('classifies a dev push as the cheap health gate', () => {
    expect.hasAssertions();

    const evidence = classify({ CIRCLE_BRANCH: 'dev' });

    expect(evidence.context).toBe(CONTEXTS.DEV_PUSH);
    expect(evidence.selectedJobs).toStrictEqual(['branch-gate', 'coverage']);
  });

  it('classifies dev to main as a release promotion that runs the full suite plus browser-matrix', () => {
    expect.hasAssertions();

    const evidence = classify({
      CIRCLE_BRANCH: 'dev',
      CIRCLE_PULL_REQUEST: 'https://github.com/web2solutions/Jumentix/pull/201',
      CIRCLE_PR_BASE_BRANCH: 'main'
    });

    expect(evidence.context).toBe(CONTEXTS.RELEASE_PR_TO_MAIN);
    expect(evidence.selectedJobs).toStrictEqual([...FULL_JOBS, 'browser-matrix']);
  });

  it('classifies a signed dev promotion branch to main as a full-suite release promotion', () => {
    expect.hasAssertions();

    const evidence = classify({
      GITHUB_EVENT_NAME: 'pull_request',
      JUMENTIX_CI_IS_PULL_REQUEST: 'true',
      GITHUB_HEAD_REF: 'codex/release/JUM-636-dev-main-signed-squash',
      GITHUB_BASE_REF: 'main'
    });

    expect(evidence.context).toBe(CONTEXTS.RELEASE_PR_TO_MAIN);
    expect(evidence.selectedJobs).toStrictEqual([...FULL_JOBS, 'browser-matrix']);
  });

  it('classifies the generated changelog sync branch as a full-suite release promotion', () => {
    expect.hasAssertions();

    const evidence = classify({
      GITHUB_EVENT_NAME: 'pull_request',
      JUMENTIX_CI_IS_PULL_REQUEST: 'true',
      GITHUB_HEAD_REF: 'chore/changelog-sync-deadbeef',
      GITHUB_BASE_REF: 'main'
    });

    expect(evidence.context).toBe(CONTEXTS.RELEASE_PR_TO_MAIN);
    expect(evidence.selectedJobs).toStrictEqual([...FULL_JOBS, 'browser-matrix']);
  });

  it('classifies the generated app-release bump branch as a full-suite release promotion', () => {
    expect.hasAssertions();

    const evidence = classify({
      GITHUB_EVENT_NAME: 'pull_request',
      JUMENTIX_CI_IS_PULL_REQUEST: 'true',
      GITHUB_HEAD_REF: 'chore/release-v0.1.0',
      GITHUB_BASE_REF: 'main'
    });

    expect(evidence.context).toBe(CONTEXTS.RELEASE_PR_TO_MAIN);
    expect(evidence.selectedJobs).toStrictEqual([...FULL_JOBS, 'browser-matrix']);
  });

  it('classifies the generated package-bump branch as a full-suite release promotion', () => {
    expect.hasAssertions();

    const evidence = classify({
      GITHUB_EVENT_NAME: 'pull_request',
      JUMENTIX_CI_IS_PULL_REQUEST: 'true',
      GITHUB_HEAD_REF: 'chore/package-bump-deadbeef',
      GITHUB_BASE_REF: 'main'
    });

    expect(evidence.context).toBe(CONTEXTS.RELEASE_PR_TO_MAIN);
    expect(evidence.selectedJobs).toStrictEqual([...FULL_JOBS, 'browser-matrix']);
  });

  it('classifies package-bump branches that include a run-id suffix', () => {
    expect.hasAssertions();

    const evidence = classify({
      GITHUB_EVENT_NAME: 'pull_request',
      JUMENTIX_CI_IS_PULL_REQUEST: 'true',
      GITHUB_HEAD_REF: 'chore/package-bump-deadbeef-123456789-2',
      GITHUB_BASE_REF: 'main'
    });

    expect(evidence.context).toBe(CONTEXTS.RELEASE_PR_TO_MAIN);
  });

  it('classifies a main push as a full-suite event', () => {
    expect.hasAssertions();

    const evidence = classify({ CIRCLE_BRANCH: 'main' });

    expect(evidence.context).toBe(CONTEXTS.MAIN_PUSH);
    expect(evidence.selectedJobs).toStrictEqual(FULL_JOBS);
  });

  it('classifies a GitHub Actions main push as a full-suite event', () => {
    expect.hasAssertions();

    const evidence = classify({ GITHUB_REF_NAME: 'main' });

    expect(evidence.context).toBe(CONTEXTS.MAIN_PUSH);
    expect(evidence.headRef).toBe('main');
    expect(evidence.selectedJobs).toStrictEqual(FULL_JOBS);
  });

  it('classifies scheduled runs as full-suite events', () => {
    expect.hasAssertions();

    const evidence = classify({
      CIRCLE_BRANCH: 'dev',
      CIRCLE_PIPELINE_TRIGGER_SOURCE: 'scheduled_pipeline'
    });

    expect(evidence.context).toBe(CONTEXTS.SCHEDULED_FULL);
    expect(evidence.selectedJobs).toStrictEqual(FULL_JOBS);
  });

  it('classifies GitHub Actions scheduled and manual runs as full-suite events', () => {
    expect.hasAssertions();

    const scheduled = classify({ GITHUB_EVENT_NAME: 'schedule', GITHUB_REF_NAME: 'dev' });
    const manual = classify({ GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REF_NAME: 'dev' });

    expect(scheduled.context).toBe(CONTEXTS.SCHEDULED_FULL);
    expect(manual.context).toBe(CONTEXTS.SCHEDULED_FULL);
    expect(scheduled.selectedJobs).toStrictEqual(FULL_JOBS);
    expect(manual.selectedJobs).toStrictEqual(FULL_JOBS);
  });

  it('fails closed when PR metadata omits the base branch', () => {
    expect.hasAssertions();

    expect(() => classify({
      CIRCLE_BRANCH: 'codex/feature/JUM-631-fast-ci',
      CIRCLE_PULL_REQUEST: 'https://github.com/web2solutions/Jumentix/pull/202'
    })).toThrow('base branch');
  });

  it('fails closed for non-dev PRs targeting main', () => {
    expect.hasAssertions();

    expect(() => classify({
      CIRCLE_BRANCH: 'codex/feature/JUM-631-fast-ci',
      CIRCLE_PULL_REQUEST: 'https://github.com/web2solutions/Jumentix/pull/203',
      CIRCLE_PR_BASE_BRANCH: 'main'
    })).toThrow('only dev may open release pull requests to main');
  });

  it('classifies Dependabot security PRs targeting main as full-suite release promotions', () => {
    expect.hasAssertions();

    const evidence = classify({
      GITHUB_EVENT_NAME: 'pull_request',
      JUMENTIX_CI_IS_PULL_REQUEST: 'true',
      GITHUB_HEAD_REF: 'dependabot/npm_and_yarn/apps/frontend/template/source-map-js-1.2.2',
      GITHUB_BASE_REF: 'main'
    });

    expect(evidence.context).toBe(CONTEXTS.RELEASE_PR_TO_MAIN);
    expect(evidence.selectedJobs).toStrictEqual([...FULL_JOBS, 'browser-matrix']);
  });

  it('classifies Dependabot version-update PRs targeting dev as task PRs', () => {
    expect.hasAssertions();

    const evidence = classify({
      GITHUB_EVENT_NAME: 'pull_request',
      JUMENTIX_CI_IS_PULL_REQUEST: 'true',
      GITHUB_HEAD_REF: 'dependabot/bun/some-package-1.2.3',
      GITHUB_BASE_REF: 'dev'
    });

    expect(evidence.context).toBe(CONTEXTS.TASK_PR_TO_DEV);
  });

  it('returns exit 78 when a job no pull request from the head can require is not selected', () => {
    expect.hasAssertions();

    // website is required only on PRs to main; a task branch never opens one.
    expect(runCli(['node', 'classify', '--require-job', 'website'], {
      CIRCLE_BRANCH: 'codex/feature/JUM-631-fast-ci'
    })).toBe(78);
    // main is never a PR head, so a main push may halt what it does not select.
    expect(runCli(['node', 'classify', '--require-job', 'browser-matrix'], {
      CIRCLE_BRANCH: 'main'
    })).toBe(78);
  });

  // Negative control (Requirement 135 §3), JUM-936. The old classifier returned
  // 78 here; require_ci_job turned 78 into `step halt` + `exit 0`, CircleCI
  // posted `ci/circleci: coverage` = success, and PR #693 opened 47 s after the
  // push found its required coverage check green without the suite having run.
  it.each([
    ['task branch push', 'claude/docs/JUM-933-requirements-text-drift', 'coverage'],
    ['task branch push', 'claude/docs/JUM-933-requirements-text-drift', 'third-party-review'],
    ['task branch push', 'claude/docs/JUM-933-requirements-text-drift', 'browser-matrix'],
    ['dev push before a release PR (PR #685)', 'dev', 'website'],
    ['dev push before a release PR (PR #685)', 'dev', 'integration'],
    ['changelog sync push before its PR (PR #691)', 'chore/changelog-sync-e02a7c15', 'coverage'],
    ['Dependabot push before its PR', 'dependabot/npm_and_yarn/lodash-4.17.21', 'database-matrix']
  ])('fails, never halts, a PR-required job on a %s (%s, %s)', (_label, branch, job) => {
    expect.hasAssertions();
    const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const logs = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    const status = runCli(['node', 'classify', '--require-job', job], { CIRCLE_BRANCH: branch });

    expect(status).toBe(1);
    expect(errors.mock.calls.join('\n')).toContain(`${job} is required on pull requests from ${branch}`);
    errors.mockRestore();
    logs.mockRestore();
  });

  it('still runs the PR-required job once the pipeline is classified as the PR', () => {
    expect.hasAssertions();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);

    expect(runCli(['node', 'classify', '--require-job', 'coverage'], {
      CIRCLE_BRANCH: 'claude/docs/JUM-933-requirements-text-drift',
      JUMENTIX_CI_IS_PULL_REQUEST: '1',
      JUMENTIX_PR_BASE_REF: 'dev'
    })).toBe(0);
    jest.restoreAllMocks();
  });

  it('records the PR-required jobs only for push contexts', () => {
    expect.hasAssertions();

    expect(classify({ CIRCLE_BRANCH: 'codex/feature/JUM-631-fast-ci' }).pullRequestRequiredJobs)
      .toStrictEqual(selectedJobsFor(CONTEXTS.TASK_PR_TO_DEV));
    expect(classify({ CIRCLE_BRANCH: 'dev' }).pullRequestRequiredJobs)
      .toStrictEqual(selectedJobsFor(CONTEXTS.RELEASE_PR_TO_MAIN));
    expect(classify({
      CIRCLE_BRANCH: 'codex/feature/JUM-631-fast-ci',
      JUMENTIX_CI_IS_PULL_REQUEST: '1',
      JUMENTIX_PR_BASE_REF: 'dev'
    }).pullRequestRequiredJobs).toStrictEqual([]);
    expect(pullRequestJobsForHead('main')).toStrictEqual([]);
  });

  it('confirms selected jobs for continuation guards', () => {
    expect.hasAssertions();

    const evidence = {
      selectedJobs: selectedJobsFor(CONTEXTS.RELEASE_PR_TO_MAIN)
    };

    expect(jobSelected(evidence, 'coverage')).toBe(true);
    expect(jobSelected(evidence, 'missing')).toBe(false);
  });

  it('selects browser-matrix and coverage for task PRs to dev and release PRs to main', () => {
    expect.hasAssertions();

    expect(selectedJobsFor(CONTEXTS.TASK_PR_TO_DEV)).toContain('browser-matrix');
    expect(selectedJobsFor(CONTEXTS.TASK_PR_TO_DEV)).toContain('coverage');
    expect(selectedJobsFor(CONTEXTS.RELEASE_PR_TO_MAIN)).toContain('browser-matrix');
    expect(selectedJobsFor(CONTEXTS.RELEASE_PR_TO_MAIN)).toContain('coverage');
  });

  it('keeps browser-matrix out of push and scheduled contexts', () => {
    expect.hasAssertions();

    expect(selectedJobsFor(CONTEXTS.TASK_BRANCH_PUSH)).not.toContain('browser-matrix');
    expect(selectedJobsFor(CONTEXTS.DEV_PUSH)).not.toContain('browser-matrix');
    expect(selectedJobsFor(CONTEXTS.MAIN_PUSH)).not.toContain('browser-matrix');
    expect(selectedJobsFor(CONTEXTS.SCHEDULED_FULL)).not.toContain('browser-matrix');
  });
});
