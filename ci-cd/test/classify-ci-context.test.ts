/* eslint-disable @typescript-eslint/no-var-requires */
const {
  CONTEXTS,
  FULL_JOBS,
  classifyCiContext,
  impliedPullRequestBase,
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

  it('runs the PR-to-dev job set on a task branch push, against dev', () => {
    expect.hasAssertions();

    // resolve-pr-metadata exports the base the branch's PR will target.
    const evidence = classify({ CIRCLE_BRANCH: 'codex/feature/JUM-631-fast-ci', JUMENTIX_PR_BASE_REF: 'dev' });

    expect(evidence).toMatchObject({
      context: CONTEXTS.TASK_BRANCH_PUSH,
      isPullRequest: false,
      headRef: 'codex/feature/JUM-631-fast-ci',
      baseRef: 'dev',
      diffBaseRef: 'origin/dev',
      selectedJobs: ['branch-gate', 'third-party-review', 'browser-matrix', 'coverage'],
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

  it('runs the release job set on a dev push, because dev heads the release PR', () => {
    expect.hasAssertions();

    const evidence = classify({ CIRCLE_BRANCH: 'dev', JUMENTIX_PR_BASE_REF: 'main' });

    expect(evidence.context).toBe(CONTEXTS.DEV_PUSH);
    expect(evidence.diffBaseRef).toBe('origin/main');
    expect(evidence.selectedJobs).toStrictEqual(selectedJobsFor(CONTEXTS.RELEASE_PR_TO_MAIN));
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
    expect(evidence.selectedJobs).toStrictEqual([...FULL_JOBS, 'browser-matrix']);
  });

  it('classifies GitHub Actions scheduled and manual runs as full-suite events', () => {
    expect.hasAssertions();

    const scheduled = classify({ GITHUB_EVENT_NAME: 'schedule', GITHUB_REF_NAME: 'dev' });
    const manual = classify({ GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REF_NAME: 'dev' });

    expect(scheduled.context).toBe(CONTEXTS.SCHEDULED_FULL);
    expect(manual.context).toBe(CONTEXTS.SCHEDULED_FULL);
    expect(scheduled.selectedJobs).toStrictEqual([...FULL_JOBS, 'browser-matrix']);
    expect(manual.selectedJobs).toStrictEqual([...FULL_JOBS, 'browser-matrix']);
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
    jest.spyOn(console, 'log').mockImplementation(() => undefined);

    // website is required only on PRs to main; a task branch never opens one.
    expect(runCli(['node', 'classify', '--require-job', 'website'], {
      CIRCLE_BRANCH: 'codex/feature/JUM-631-fast-ci'
    })).toBe(78);
    // main is never a PR head, so a main push may halt what it does not select.
    expect(runCli(['node', 'classify', '--require-job', 'browser-matrix'], {
      CIRCLE_BRANCH: 'main'
    })).toBe(78);
    jest.restoreAllMocks();
  });

  // Negative controls (Requirement 135 §3). Before JUM-936 these returned 78:
  // require_ci_job halted, CircleCI posted success, and the PR opened after the
  // push (PR #693; #685 and #691 to main) accepted it without the suite running.
  // After JUM-936 they returned 1, so every tip without a PR was red. JUM-939:
  // the push runs exactly what its PR would require, so the status is real.
  it.each([
    ['task branch push (PR #693)', 'claude/docs/JUM-933-requirements-text-drift', 'coverage'],
    ['task branch push (PR #693)', 'claude/docs/JUM-933-requirements-text-drift', 'third-party-review'],
    ['task branch push (PR #693)', 'claude/docs/JUM-933-requirements-text-drift', 'browser-matrix'],
    ['dev push before a release PR (PR #685)', 'dev', 'website'],
    ['dev push before a release PR (PR #685)', 'dev', 'integration'],
    ['dev push before a release PR (PR #685)', 'dev', 'browser-matrix'],
    ['scheduled run on dev', 'dev', 'browser-matrix', { CIRCLE_PIPELINE_TRIGGER_SOURCE: 'scheduled_pipeline' }]
  ])('runs, never halts or fails, a PR-required job on a %s (%s, %s)', (_label, branch, job, extra: Record<string, string> = {}) => {
    expect.hasAssertions();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);

    expect(runCli(['node', 'classify', '--require-job', job], { CIRCLE_BRANCH: branch, ...extra })).toBe(0);
    jest.restoreAllMocks();
  });

  // A head whose PR base is unknowable or whose release PR needs PR-only
  // evidence still fails rather than halting when its PR is not resolved.
  it.each([
    ['changelog sync push before its PR (PR #691)', 'chore/changelog-sync-e02a7c15', 'website'],
    ['Dependabot push before its PR', 'dependabot/npm_and_yarn/lodash-4.17.21', 'database-matrix']
  ])('fails, never halts, a job a %s does not run (%s, %s)', (_label, branch, job) => {
    expect.hasAssertions();
    const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);

    expect(runCli(['node', 'classify', '--require-job', job], { CIRCLE_BRANCH: branch })).toBe(1);
    expect(errors.mock.calls.join('\n')).toContain(`${job} is required on pull requests from ${branch}`);
    jest.restoreAllMocks();
  });

  it('names the base a push runs against, and none where it cannot be known', () => {
    expect.hasAssertions();

    expect([
      impliedPullRequestBase('claude/ci/JUM-939-run-pr-suites-on-push'),
      impliedPullRequestBase('dev'),
      impliedPullRequestBase('chore/changelog-sync-e02a7c15'),
      impliedPullRequestBase('main'),
      impliedPullRequestBase('dependabot/npm_and_yarn/lodash-4.17.21')
    ]).toStrictEqual(['dev', 'main', 'main', '', '']);
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

  it('keeps browser-matrix out of main pushes only, since main is never a PR head', () => {
    expect.hasAssertions();

    expect(selectedJobsFor(CONTEXTS.TASK_BRANCH_PUSH)).toContain('browser-matrix');
    expect(selectedJobsFor(CONTEXTS.DEV_PUSH)).toContain('browser-matrix');
    expect(selectedJobsFor(CONTEXTS.SCHEDULED_FULL)).toContain('browser-matrix');
    expect(selectedJobsFor(CONTEXTS.MAIN_PUSH)).not.toContain('browser-matrix');
  });
});
