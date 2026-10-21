/* eslint-disable @typescript-eslint/no-var-requires */
const { execFileSync } = require('child_process');
const { exportLines, main, resolvePullRequest } = require('../resolve-pr-metadata');
const classifier = require('../classify-ci-context');

const REPO = 'web2solutions/Jumentix';
const BRANCH = 'claude/docs/JUM-933-requirements-text-drift';
const PR_693 = {
  number: 693,
  html_url: 'https://github.com/web2solutions/Jumentix/pull/693',
  base: { ref: 'dev' },
  head: { ref: BRANCH },
  title: '[JUM-933][Docs] Reconcile requirement text, index and NFR registry with dev gates',
  body: 'Body with \'quotes\' and $(not a command)'
};

function respond(body: unknown, status = 200) {
  return {
    ok: status < 400, status, statusText: status < 400 ? 'OK' : 'Forbidden', json: async () => body
  };
}

/** A fetch double recording the URL and headers each lookup sent. */
function fetchReturning(body: unknown, status = 200) {
  return jest.fn(
    async (_url: string, _init: { headers: Record<string, string> }) => respond(body, status)
  );
}

/** Runs the printed lines through bash, the way `$BASH_ENV` is sourced. */
function sourceExports(lines: string[]): Record<string, string> {
  const script = `${lines.join('\n')}\nenv -0`;
  const output = execFileSync('bash', ['-c', script], { encoding: 'utf8', env: {} });
  return Object.fromEntries(output.split('\0').filter(Boolean).map((entry: string) => {
    const index = entry.indexOf('=');
    return [entry.slice(0, index), entry.slice(index + 1)];
  }));
}

async function pipelineEnv(
  pulls: unknown[],
  env: Record<string, string> = {}
): Promise<Record<string, string>> {
  const lines: string[] = [];
  await main({
    CIRCLE_PROJECT_USERNAME: 'web2solutions',
    CIRCLE_PROJECT_REPONAME: 'Jumentix',
    CIRCLE_BRANCH: BRANCH,
    ...env
  }, {
    fetchImpl: async () => respond(pulls),
    write: (line: string) => lines.push(line)
  });
  return { CIRCLE_BRANCH: BRANCH, ...sourceExports(lines) };
}

describe('resolve-pr-metadata', () => {
  it('looks the open PR up by head branch when CIRCLE_PULL_REQUEST is empty', async () => {
    expect.hasAssertions();
    const fetchImpl = fetchReturning([PR_693]);

    const pr = await resolvePullRequest({
      repo: REPO, pullRequestUrl: '', branch: BRANCH, fetchImpl
    });

    expect(pr.number).toBe(693);
    expect(fetchImpl.mock.calls[0][0]).toBe(
      `https://api.github.com/repos/${REPO}/pulls?head=${encodeURIComponent(`web2solutions:${BRANCH}`)}&state=open&per_page=2`
    );
  });

  // JUM-936 end to end, push-then-PR: the pipeline for ce266b23 started at
  // 02:38:12Z without CIRCLE_PULL_REQUEST; PR #693 opened at 02:38:57Z.
  it('classifies a pipeline whose PR opened after the push as the PR, so coverage runs', async () => {
    expect.hasAssertions();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);

    const env = await pipelineEnv([PR_693]);

    expect(env.CIRCLE_PULL_REQUEST).toBe(PR_693.html_url);
    expect(env.JUMENTIX_PR_BODY).toBe(PR_693.body);
    expect(classifier.classifyCiContext({ env, spawn: () => ({ status: 0, stdout: '' }) }).context).toBe('task-pr-to-dev');
    expect(classifier.runCli(['node', 'classify', '--require-job', 'coverage'], env)).toBe(0);
    jest.restoreAllMocks();
  });

  it('leaves a pipeline with no PR yet red, not green, on its PR-required jobs', async () => {
    expect.hasAssertions();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);

    const env = await pipelineEnv([]);

    expect(env.JUMENTIX_CI_IS_PULL_REQUEST).toBe('0');
    expect(env.CIRCLE_PULL_REQUEST).toBeUndefined();
    for (const job of ['third-party-review', 'browser-matrix', 'coverage']) {
      expect(classifier.runCli(['node', 'classify', '--require-job', job], env)).toBe(1);
    }
    expect(classifier.runCli(['node', 'classify', '--require-job', 'branch-gate'], env)).toBe(0);
    jest.restoreAllMocks();
  });

  it('keeps using the PR CircleCI reported', async () => {
    expect.hasAssertions();
    const fetchImpl = fetchReturning(PR_693);

    const pr = await resolvePullRequest({
      repo: REPO, pullRequestUrl: PR_693.html_url, branch: BRANCH, fetchImpl
    });

    expect(pr.base.ref).toBe('dev');
    expect(fetchImpl.mock.calls[0][0]).toBe(`https://api.github.com/repos/${REPO}/pulls/693`);
  });

  it('never looks up a PR for main', async () => {
    expect.hasAssertions();
    const fetchImpl = jest.fn();

    await expect(resolvePullRequest({
      repo: REPO, pullRequestUrl: '', branch: 'main', fetchImpl
    })).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('fails closed when two open PRs share the head branch', async () => {
    expect.hasAssertions();
    const fetchImpl = async () => respond([PR_693, { ...PR_693, number: 694 }]);

    await expect(resolvePullRequest({
      repo: REPO, pullRequestUrl: '', branch: BRANCH, fetchImpl
    }))
      .rejects.toThrow('2 open pull requests have head');
  });

  it('fails closed when GitHub refuses the lookup', async () => {
    expect.hasAssertions();
    const fetchImpl = async () => respond({ message: 'API rate limit exceeded' }, 403);

    await expect(resolvePullRequest({
      repo: REPO, pullRequestUrl: '', branch: BRANCH, fetchImpl
    }))
      .rejects.toThrow('failed to resolve PR metadata: 403');
  });

  it('sends a token when the CircleCI context provides one', async () => {
    expect.hasAssertions();
    const fetchImpl = fetchReturning([]);

    await resolvePullRequest({
      repo: REPO, pullRequestUrl: '', branch: BRANCH, fetchImpl, token: 't0k'
    });

    expect(fetchImpl.mock.calls[0][1].headers.authorization).toBe('Bearer t0k');
  });

  it('quotes untrusted PR text so sourcing BASH_ENV cannot execute it', () => {
    expect.hasAssertions();

    const env = sourceExports(exportLines({ ...PR_693, title: 'x\'; touch /tmp/pwned; \'' }, BRANCH));

    expect(env.JUMENTIX_PR_TITLE).toBe('x\'; touch /tmp/pwned; \'');
    expect(env.AAA_PR_BODY).toBe(PR_693.body);
  });
});
