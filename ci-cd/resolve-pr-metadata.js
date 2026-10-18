#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Resolves the pull request a CircleCI pipeline belongs to and prints the
 * `export` lines `resolve_pr_metadata` appends to `$BASH_ENV` (JUM-936).
 *
 * CircleCI sets `CIRCLE_PULL_REQUEST` only when the PR existed as the pipeline
 * started. A branch pushed and then opened as a PR seconds later (PR #693: 47 s)
 * ran as a push, and opening the PR started no new pipeline. When the variable
 * is empty this looks the open PR up by head branch instead, so a pipeline that
 * reaches this step after the PR opened, or a workflow re-run, is classified as
 * the PR it is. A PR found this way also exports `CIRCLE_PULL_REQUEST`, because
 * later steps (patch coverage, Sonar) read it directly.
 *
 * Fails closed: an API error or more than one open PR for the branch exits
 * non-zero rather than guessing a context (Requirement 113 §12).
 */
const { isEntryPoint } = require('./lib/entry-point.js');

const shellQuote = (value) => `'${String(value || '').replace(/'/g, "'\\''")}'`;

async function getJson(url, { fetchImpl = fetch, token = '' } = {}) {
  const headers = { accept: 'application/vnd.github+json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetchImpl(url, { headers });
  if (!response.ok) {
    throw new Error(`failed to resolve PR metadata: ${response.status} ${response.statusText} (${url})`);
  }
  return response.json();
}

/**
 * @returns {Promise<object|null>} the GitHub pull request, or `null` when the
 * pipeline has no open PR.
 */
async function resolvePullRequest({ repo, pullRequestUrl, branch, fetchImpl, token }) {
  const api = `https://api.github.com/repos/${repo}`;
  if (pullRequestUrl) {
    const number = pullRequestUrl.split('/').pop();
    return getJson(`${api}/pulls/${number}`, { fetchImpl, token });
  }
  // `main` is never a PR head (Requirement 086 §10).
  if (!branch || branch === 'main') return null;

  const owner = repo.split('/')[0];
  const query = `head=${encodeURIComponent(`${owner}:${branch}`)}&state=open&per_page=2`;
  const pulls = await getJson(`${api}/pulls?${query}`, { fetchImpl, token });
  if (pulls.length > 1) {
    throw new Error(
      `[pr-metadata] ${pulls.length} open pull requests have head ${branch} `
      + `(#${pulls.map((pr) => pr.number).join(', #')}); cannot choose a CI context`
    );
  }
  return pulls[0] || null;
}

function exportLines(pr, branch) {
  if (!pr) {
    return [
      'export AAA_CI_IS_PULL_REQUEST=0',
      'export JUMENTIX_CI_IS_PULL_REQUEST=0',
      `export JUMENTIX_QUALITY_GATE_TARGET=${shellQuote(branch || 'dev')}`,
      `export JUMENTIX_PR_HEAD_REF=${shellQuote(branch)}`,
      `export AAA_PR_HEAD_REF=${shellQuote(branch)}`
    ];
  }
  return [
    `export CIRCLE_PULL_REQUEST=${shellQuote(pr.html_url)}`,
    'export AAA_CI_IS_PULL_REQUEST=1',
    'export JUMENTIX_CI_IS_PULL_REQUEST=1',
    `export JUMENTIX_PR_BASE_REF=${shellQuote(pr.base?.ref)}`,
    `export AAA_PR_BASE_REF=${shellQuote(pr.base?.ref)}`,
    `export JUMENTIX_QUALITY_GATE_TARGET=${shellQuote(pr.base?.ref)}`,
    `export JUMENTIX_PR_HEAD_REF=${shellQuote(pr.head?.ref)}`,
    `export AAA_PR_HEAD_REF=${shellQuote(pr.head?.ref)}`,
    `export JUMENTIX_PR_TITLE=${shellQuote(pr.title)}`,
    `export AAA_PR_TITLE=${shellQuote(pr.title)}`,
    `export JUMENTIX_PR_BODY=${shellQuote(pr.body)}`,
    `export AAA_PR_BODY=${shellQuote(pr.body)}`
  ];
}

async function main(env = process.env, { fetchImpl, write = console.log } = {}) {
  const branch = String(env.CIRCLE_BRANCH || '').trim();
  const pr = await resolvePullRequest({
    repo: `${env.CIRCLE_PROJECT_USERNAME}/${env.CIRCLE_PROJECT_REPONAME}`,
    pullRequestUrl: String(env.CIRCLE_PULL_REQUEST || '').trim(),
    branch,
    fetchImpl,
    token: env.GH_TOKEN || env.GITHUB_TOKEN || ''
  });
  if (pr && !env.CIRCLE_PULL_REQUEST) {
    console.error(`[pr-metadata] resolved open PR #${pr.number} for ${branch} by head branch`);
  }
  exportLines(pr, branch).forEach((line) => write(line));
}

if (isEntryPoint(module)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { exportLines, main, resolvePullRequest, shellQuote };
