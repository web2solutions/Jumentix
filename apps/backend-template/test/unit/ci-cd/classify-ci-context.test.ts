/* eslint-disable @typescript-eslint/no-var-requires */
const {
  CONTEXTS,
  FULL_JOBS,
  classifyCiContext,
  jobSelected,
  runCli,
  selectedJobsFor
} = require('../../../../../ci-cd/classify-ci-context');

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

  it('classifies a task PR to dev as branch-gate plus third-party-review', () => {
    expect.hasAssertions();

    const evidence = classify({
      CIRCLE_BRANCH: 'codex/feature/JUM-631-fast-ci',
      CIRCLE_PULL_REQUEST: 'https://github.com/XpertMinds/Jumentix/pull/200',
      CIRCLE_PR_BASE_BRANCH: 'dev'
    });

    expect(evidence.context).toBe(CONTEXTS.TASK_PR_TO_DEV);
    expect(evidence.selectedJobs).toStrictEqual(['branch-gate', 'third-party-review']);
  });

  it('classifies a dev push as the cheap health gate', () => {
    expect.hasAssertions();

    const evidence = classify({ CIRCLE_BRANCH: 'dev' });

    expect(evidence.context).toBe(CONTEXTS.DEV_PUSH);
    expect(evidence.selectedJobs).toStrictEqual(['branch-gate']);
  });

  it('classifies dev to main as a release promotion that runs the full suite', () => {
    expect.hasAssertions();

    const evidence = classify({
      CIRCLE_BRANCH: 'dev',
      CIRCLE_PULL_REQUEST: 'https://github.com/XpertMinds/Jumentix/pull/201',
      CIRCLE_PR_BASE_BRANCH: 'main'
    });

    expect(evidence.context).toBe(CONTEXTS.RELEASE_PR_TO_MAIN);
    expect(evidence.selectedJobs).toStrictEqual(FULL_JOBS);
  });

  it('classifies signed dev promotion branches to main as full-suite release promotions', () => {
    expect.hasAssertions();

    const evidence = classify({
      CIRCLE_BRANCH: 'codex/release/JUM-634-dev-main-signed-squash',
      CIRCLE_PULL_REQUEST: 'https://github.com/XpertMinds/Jumentix/pull/204',
      CIRCLE_PR_BASE_BRANCH: 'main'
    });

    expect(evidence.context).toBe(CONTEXTS.RELEASE_PR_TO_MAIN);
    expect(evidence.selectedJobs).toStrictEqual(FULL_JOBS);
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
      CIRCLE_PULL_REQUEST: 'https://github.com/XpertMinds/Jumentix/pull/202'
    })).toThrow('base branch');
  });

  it('fails closed for non-dev PRs targeting main', () => {
    expect.hasAssertions();

    expect(() => classify({
      CIRCLE_BRANCH: 'codex/feature/JUM-631-fast-ci',
      CIRCLE_PULL_REQUEST: 'https://github.com/XpertMinds/Jumentix/pull/203',
      CIRCLE_PR_BASE_BRANCH: 'main'
    })).toThrow('only dev may open release pull requests to main');
  });

  it('returns exit 78 when a required job is not selected', () => {
    expect.hasAssertions();

    expect(runCli(['node', 'classify', '--require-job', 'coverage'], {
      CIRCLE_BRANCH: 'codex/feature/JUM-631-fast-ci'
    })).toBe(78);
  });

  it('confirms selected jobs for continuation guards', () => {
    expect.hasAssertions();

    const evidence = {
      selectedJobs: selectedJobsFor(CONTEXTS.RELEASE_PR_TO_MAIN)
    };

    expect(jobSelected(evidence, 'coverage')).toBe(true);
    expect(jobSelected(evidence, 'missing')).toBe(false);
  });
});
