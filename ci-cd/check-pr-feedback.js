#!/usr/bin/env bun
/* eslint-disable no-console */

const { isEntryPoint } = require('./lib/entry-point.js');

const API_URL = 'https://api.github.com/graphql';
const MAX_PAGES = 100;
const MAINTAINER_ASSOCIATIONS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);
const MARKER_PREFIX = '<!-- jumentix-pr-feedback:';
const MARKER_PATTERN = /<!--\s*jumentix-pr-feedback:\s*(resolved|invalid)\s+comment=(\S+?)(?:\s+commit=([0-9a-fA-F]{7,40}))?\s*-->/g;

function isCursorUsageLimitNotice(comment) {
  return comment?.author?.login === 'cursor'
    && /(?:out of (?:credit|limit)|usage(?:\s+or\s+spend)?\s+limit|usage limit reached)/i.test(comment.body || '');
}

/**
 * Automated quality/status decorations carry no human feedback to resolve:
 * SonarCloud posts its Quality Gate banner on every analyzed PR and updates
 * it in place, which the PR feedback gate must not demand a resolution marker
 * for. Same category as the Cursor usage-limit notice above.
 */
function isAutomatedStatusDecoration(comment) {
  const login = comment?.author?.login || '';
  if (login === 'sonarqubecloud' && /quality gate/i.test(comment.body || '')) return true;
  // Codecov posts a coverage summary on every PR; it is status decoration, not
  // human review feedback (proven by #479 blocking on codecov[bot] comments).
  if (login === 'codecov' && /codecov\.io/i.test(comment.body || '')) return true;
  return false;
}

function parseResolutionMarker(body) {
  if (!body?.includes(MARKER_PREFIX)) return null;

  const matches = [...body.matchAll(MARKER_PATTERN)];
  const prefixes = body.match(/<!--\s*jumentix-pr-feedback:/g) || [];
  if (matches.length !== 1 || matches.length !== prefixes.length) {
    throw new Error('Resolution markers must contain exactly one well-formed jumentix-pr-feedback marker.');
  }

  const [marker, kind, commentUrl, commit] = matches[0];
  if (kind === 'resolved' && !commit) {
    throw new Error('A resolved marker must include a PR commit SHA.');
  }
  if (kind === 'invalid' && commit) {
    throw new Error('An invalid marker must not include a commit SHA.');
  }

  const explanation = body.replace(marker, '').trim();
  if (kind === 'invalid' && explanation.length < 8) {
    throw new Error('An invalid marker requires a factual visible explanation outside the marker.');
  }

  return { kind, commentUrl, commit: commit?.toLowerCase(), explanation };
}

function isAuthorizedResolver(comment, pullRequestAuthor) {
  return comment?.author?.login === pullRequestAuthor
    || MAINTAINER_ASSOCIATIONS.has(comment?.authorAssociation);
}

function resolveCommit(commitPrefix, commits) {
  const matches = commits.filter((commit) => commit.toLowerCase().startsWith(commitPrefix));
  if (matches.length !== 1) {
    throw new Error(`Resolution commit ${commitPrefix} must identify exactly one commit in this pull request.`);
  }
  return matches[0];
}

function validatePullRequestFeedback({ pullRequestAuthor, comments, reviewThreads, commits }) {
  if (!pullRequestAuthor || !Array.isArray(comments) || !Array.isArray(reviewThreads) || !Array.isArray(commits)) {
    throw new Error('GitHub pull-request feedback response is incomplete.');
  }

  const commentByUrl = new Map();
  const evidenceByCommentUrl = new Set();
  const failures = [];

  for (const comment of comments) {
    if (!comment?.url || !comment?.author?.login) {
      failures.push('A general PR comment is missing its URL or author.');
      continue;
    }
    commentByUrl.set(comment.url, comment);
  }

  for (const comment of comments) {
    let marker;
    try {
      marker = parseResolutionMarker(comment.body);
    } catch (error) {
      failures.push(`${comment.url}: ${error.message}`);
      continue;
    }
    if (!marker) continue;

    if (!isAuthorizedResolver(comment, pullRequestAuthor)) {
      failures.push(`${comment.url}: resolution evidence must be authored by the PR author or a repository maintainer.`);
      continue;
    }
    if (!commentByUrl.has(marker.commentUrl)) {
      failures.push(`${comment.url}: resolution marker references a comment that does not belong to this pull request.`);
      continue;
    }
    if (marker.commentUrl === comment.url) {
      failures.push(`${comment.url}: a resolution marker cannot resolve itself.`);
      continue;
    }
    if (marker.kind === 'resolved') {
      try {
        resolveCommit(marker.commit, commits);
      } catch (error) {
        failures.push(`${comment.url}: ${error.message}`);
        continue;
      }
    }
    evidenceByCommentUrl.add(marker.commentUrl);
  }

  for (const thread of reviewThreads) {
    if (thread?.isResolved === true) continue;
    const threadComments = thread?.comments || [];
    if (threadComments.length > 0 && threadComments.every(isCursorUsageLimitNotice)) continue;
    failures.push(`Review thread ${thread?.id || 'without an id'} is not resolved in GitHub.`);
  }

  for (const comment of comments) {
    let marker;
    try {
      marker = parseResolutionMarker(comment.body);
    } catch {
      continue;
    }
    if (marker || isCursorUsageLimitNotice(comment) || isAutomatedStatusDecoration(comment)) continue;
    if (!evidenceByCommentUrl.has(comment.url)) {
      failures.push(`${comment.url}: general PR feedback needs a valid resolved or invalid response marker.`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`PR feedback gate failed:\n${failures.map((failure) => `- ${failure}`).join('\n')}`);
  }
}

async function collectConnectionPages(fetchPage, maxPages = MAX_PAGES) {
  const nodes = [];
  let cursor = null;
  for (let page = 0; page < maxPages; page += 1) {
    const connection = await fetchPage(cursor);
    if (!connection || !Array.isArray(connection.nodes) || !connection.pageInfo || typeof connection.pageInfo.hasNextPage !== 'boolean') {
      throw new Error('GitHub GraphQL pagination response is incomplete.');
    }
    nodes.push(...connection.nodes);
    if (!connection.pageInfo.hasNextPage) return nodes;
    if (!connection.pageInfo.endCursor) throw new Error('GitHub GraphQL pagination cursor is missing.');
    cursor = connection.pageInfo.endCursor;
  }
  throw new Error(`GitHub GraphQL pagination exceeded ${maxPages} pages.`);
}

async function githubGraphql(token, query, variables, fetchFn = fetch) {
  const response = await fetchFn(API_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'jumentix-pr-feedback-gate'
    },
    body: JSON.stringify({ query, variables })
  });
  if (!response.ok) throw new Error(`GitHub GraphQL request failed: ${response.status} ${response.statusText}`);
  const payload = await response.json();
  if (payload.errors?.length || !payload.data) {
    throw new Error(`GitHub GraphQL request failed: ${(payload.errors || []).map((error) => error.message).join('; ') || 'missing data'}`);
  }
  return payload.data;
}

const PR_AUTHOR_QUERY = `query PullRequestAuthor($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) { pullRequest(number: $number) { author { login } } }
}`;
const COMMENTS_QUERY = `query PullRequestComments($owner: String!, $repo: String!, $number: Int!, $cursor: String) {
  repository(owner: $owner, name: $repo) { pullRequest(number: $number) {
    comments(first: 100, after: $cursor) { pageInfo { hasNextPage endCursor } nodes { url body author { login } authorAssociation } }
  } }
}`;
const THREADS_QUERY = `query PullRequestThreads($owner: String!, $repo: String!, $number: Int!, $cursor: String) {
  repository(owner: $owner, name: $repo) { pullRequest(number: $number) {
    reviewThreads(first: 100, after: $cursor) { pageInfo { hasNextPage endCursor } nodes { id isResolved comments(first: 100) { pageInfo { hasNextPage } nodes { body author { login } } } } }
  } }
}`;
const COMMITS_QUERY = `query PullRequestCommits($owner: String!, $repo: String!, $number: Int!, $cursor: String) {
  repository(owner: $owner, name: $repo) { pullRequest(number: $number) {
    commits(first: 100, after: $cursor) { pageInfo { hasNextPage endCursor } nodes { commit { oid } } }
  } }
}`;

function pullRequestFrom(data) {
  const pullRequest = data?.repository?.pullRequest;
  if (!pullRequest) throw new Error('GitHub GraphQL response did not contain the requested pull request.');
  return pullRequest;
}

async function loadPullRequestFeedback({ owner, repo, number, token, fetchFn = fetch }) {
  const variables = { owner, repo, number };
  const authorData = await githubGraphql(token, PR_AUTHOR_QUERY, variables, fetchFn);
  const pullRequestAuthor = pullRequestFrom(authorData).author?.login;
  if (!pullRequestAuthor) throw new Error('GitHub pull request author is unavailable.');

  const page = (query, field) => collectConnectionPages(async (cursor) => {
    const data = await githubGraphql(token, query, { ...variables, cursor }, fetchFn);
    return pullRequestFrom(data)[field];
  });
  const [comments, reviewThreads, commitNodes] = await Promise.all([
    page(COMMENTS_QUERY, 'comments'),
    page(THREADS_QUERY, 'reviewThreads'),
    page(COMMITS_QUERY, 'commits')
  ]);
  for (const thread of reviewThreads) {
    if (thread.comments?.pageInfo?.hasNextPage) {
      throw new Error(`Review thread ${thread.id || 'without an id'} has more comments than the verified page size.`);
    }
    thread.comments = thread.comments?.nodes || [];
  }
  return { pullRequestAuthor, comments, reviewThreads, commits: commitNodes.map((node) => node?.commit?.oid).filter(Boolean) };
}

function parseArguments(argv) {
  const repoIndex = argv.indexOf('--repo');
  const prIndex = argv.indexOf('--pr');
  const repo = repoIndex >= 0 ? argv[repoIndex + 1] : '';
  const number = Number(prIndex >= 0 ? argv[prIndex + 1] : 0);
  if (!/^[^/\s]+\/[^/\s]+$/.test(repo) || !Number.isSafeInteger(number) || number < 1) {
    throw new Error('Usage: check-pr-feedback.js --repo owner/repository --pr positive-number');
  }
  return { owner: repo.split('/')[0], repo: repo.split('/')[1], number };
}

async function run({ argv = process.argv.slice(2), env = process.env, fetchFn = fetch } = {}) {
  if (!env.GH_TOKEN) throw new Error('GH_TOKEN is required to enforce PR feedback resolution.');
  const args = parseArguments(argv);
  const feedback = await loadPullRequestFeedback({ ...args, token: env.GH_TOKEN, fetchFn });
  validatePullRequestFeedback(feedback);
  console.log(`[pr-feedback] PR #${args.number} feedback is resolved.`);
}

if (isEntryPoint(module)) {
  run().catch((error) => {
    console.error(`[pr-feedback] ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  MAINTAINER_ASSOCIATIONS,
  collectConnectionPages,
  githubGraphql,
  isAutomatedStatusDecoration,
  isAuthorizedResolver,
  isCursorUsageLimitNotice,
  loadPullRequestFeedback,
  parseArguments,
  parseResolutionMarker,
  resolveCommit,
  run,
  validatePullRequestFeedback
};
