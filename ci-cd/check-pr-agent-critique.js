#!/usr/bin/env bun
/* eslint-disable no-console */

const { isEntryPoint } = require('./lib/entry-point.js');
const { githubGraphql, collectConnectionPages } = require('./check-pr-feedback.js');
const {
  isAutomatedPullRequest,
  isPlaceholder,
  readField
} = require('./check-pr-governance.js');

const IMPLEMENTER_FIELD = 'Epic-delegated agent ID';
const MARKER_PREFIX = 'jumentix-agent-critique:';
const MARKER_PATTERN = /<!--\s*jumentix-agent-critique:\s*verdict=(approve|request-changes)\s+reviewer=([A-Za-z0-9][A-Za-z0-9._-]{0,63})\s*-->/g;
const MIN_CRITIQUE_PROSE = 40;
const API_URL_PAGE = 100;

function visibleCritique(body, marker) {
  return String(body || '').replace(marker, '').trim();
}

function parseCritiqueMarker(body) {
  const source = String(body || '');
  if (!source.includes(MARKER_PREFIX)) return null;

  const matches = [...source.matchAll(MARKER_PATTERN)];
  const prefixes = source.match(/<!--\s*jumentix-agent-critique:/g) || [];
  if (matches.length !== 1 || matches.length !== prefixes.length) {
    throw new Error(
      'An agent-critique comment must contain exactly one well-formed '
      + 'jumentix-agent-critique marker.'
    );
  }

  const [marker, verdict, reviewer] = matches[0];
  const prose = visibleCritique(source, marker);
  if (prose.length < MIN_CRITIQUE_PROSE) {
    throw new Error(
      `The critique prose outside the marker must be at least ${MIN_CRITIQUE_PROSE} characters.`
    );
  }

  return { verdict, reviewer: reviewer.toLowerCase(), prose };
}

/**
 * Non-automated pull requests targeting `dev` stay blocked until a different
 * agent's latest critique verdict is `approve`. Automated pull requests and
 * every other base skip the gate (Requirement 139).
 *
 * @param {{
 *   baseRef?: string,
 *   headRef?: string,
 *   title?: string,
 *   body?: string,
 *   comments?: Array<{ url?: string, body?: string, createdAt?: string }>
 * }} metadata
 * @returns {string[]} failures. Empty means the gate passes.
 */
function validateAgentCritique(metadata) {
  const baseRef = String(metadata?.baseRef || '').trim();
  if (baseRef !== 'dev') return [];
  if (isAutomatedPullRequest(metadata || {})) return [];

  const failures = [];
  const implementer = readField(metadata?.body, IMPLEMENTER_FIELD).toLowerCase();
  if (isPlaceholder(implementer)) {
    failures.push(
      '[agent-critique] non-automated PR to dev must declare '
      + `${IMPLEMENTER_FIELD} so the reviewer is a different agent.`
    );
    return failures;
  }

  if (!Array.isArray(metadata?.comments)) {
    return ['[agent-critique] pull-request comments are required to judge the critique.'];
  }

  const critiques = [];
  for (const comment of metadata.comments) {
    let parsed;
    try {
      parsed = parseCritiqueMarker(comment?.body);
    } catch (error) {
      failures.push(`${comment?.url || '<missing url>'}: ${error.message}`);
      continue;
    }
    if (!parsed) continue;
    if (!comment?.url || !comment?.createdAt) {
      failures.push(
        `${comment?.url || '<missing url>'}: an agent-critique comment needs a URL and createdAt.`
      );
      continue;
    }
    if (parsed.reviewer === implementer) continue;
    critiques.push({ ...parsed, url: comment.url, createdAt: comment.createdAt });
  }

  if (failures.length > 0) return failures;

  critiques.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const latest = critiques[critiques.length - 1];
  if (!latest) {
    return [
      '[agent-critique] PR to dev needs a critique comment from an agent other than '
      + `${implementer}. Marker: <!-- jumentix-agent-critique: verdict=approve|request-changes `
      + 'reviewer=<other-agent-id> -->'
    ];
  }
  if (latest.verdict === 'request-changes') {
    return [
      `${latest.url}: reviewer ${latest.reviewer} requested changes. `
      + `The implementing agent must fix every point in that critique, then ${latest.reviewer} `
      + 'must post a later comment with verdict=approve.'
    ];
  }
  return [];
}

const PR_METADATA_QUERY = `query PullRequestCritique($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) { title body baseRefName headRefName }
  }
}`;

const COMMENTS_QUERY = `query CritiqueComments($owner: String!, $repo: String!, $number: Int!, $cursor: String) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      comments(first: ${API_URL_PAGE}, after: $cursor) {
        nodes { url body createdAt }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}`;

function parseArguments(argv) {
  const repoIndex = argv.indexOf('--repo');
  const prIndex = argv.indexOf('--pr');
  const repo = repoIndex >= 0 ? argv[repoIndex + 1] : '';
  const number = Number(prIndex >= 0 ? argv[prIndex + 1] : 0);
  if (!/^[^/\s]+\/[^/\s]+$/.test(repo) || !Number.isSafeInteger(number) || number < 1) {
    throw new Error('Usage: check-pr-agent-critique.js --repo owner/repository --pr positive-number');
  }
  return { owner: repo.split('/')[0], repo: repo.split('/')[1], number };
}

async function loadPullRequest(args, token, fetchFn) {
  const data = await githubGraphql(token, PR_METADATA_QUERY, {
    owner: args.owner,
    repo: args.repo,
    number: args.number
  }, fetchFn);
  const pullRequest = data?.repository?.pullRequest;
  if (!pullRequest) throw new Error(`Pull request #${args.number} was not found.`);

  const comments = await collectConnectionPages(async (cursor) => {
    const page = await githubGraphql(token, COMMENTS_QUERY, {
      owner: args.owner,
      repo: args.repo,
      number: args.number,
      cursor
    }, fetchFn);
    const connection = page?.repository?.pullRequest?.comments;
    if (!connection) throw new Error('GitHub pull-request comments response is incomplete.');
    return connection;
  });

  return {
    title: pullRequest.title,
    body: pullRequest.body,
    baseRef: pullRequest.baseRefName,
    headRef: pullRequest.headRefName,
    comments
  };
}

async function run({ argv = process.argv.slice(2), env = process.env, fetchFn = fetch } = {}) {
  if (!env.GH_TOKEN) throw new Error('GH_TOKEN is required to enforce the agent critique.');
  const args = parseArguments(argv);
  const metadata = await loadPullRequest(args, env.GH_TOKEN, fetchFn);
  const failures = validateAgentCritique(metadata);
  if (failures.length > 0) {
    throw new Error(`Agent critique gate failed:\n${failures.map((failure) => `- ${failure}`).join('\n')}`);
  }
  console.log(`[agent-critique] PR #${args.number} critique gate passed.`);
}

if (isEntryPoint(module)) {
  run().catch((error) => {
    console.error(`[agent-critique] ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  MIN_CRITIQUE_PROSE,
  IMPLEMENTER_FIELD,
  parseCritiqueMarker,
  validateAgentCritique,
  run
};
