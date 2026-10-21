#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { isEntryPoint } = require('./lib/entry-point.js');

const CONTEXTS = Object.freeze({
  TASK_BRANCH_PUSH: 'task-branch-push',
  TASK_PR_TO_DEV: 'task-pr-to-dev',
  DEV_PUSH: 'dev-push',
  RELEASE_PR_TO_MAIN: 'release-pr-to-main',
  MAIN_PUSH: 'main-push',
  SCHEDULED_FULL: 'scheduled-full'
});

const FULL_JOBS = Object.freeze([
  'branch-gate',
  'workspace-builds',
  'workspace-tests',
  'integration',
  'coverage',
  'website',
  'third-party-review',
  'database-matrix'
]);

const TASK_PR_JOBS = Object.freeze([
  'branch-gate', 'third-party-review', 'browser-matrix', 'coverage'
]);
const RELEASE_JOBS = Object.freeze([...FULL_JOBS, 'browser-matrix']);

// A push runs the jobs its pull request would require, against that PR's base
// (JUM-939). CircleCI reports a halted job as success and opening a PR starts
// no new pipeline, so a push that halted them left a green the PR accepted
// without the suite running (JUM-936); failing them instead turned every tip
// red. Running them makes the push status both green and true for the PR.
const JOBS_BY_CONTEXT = Object.freeze({
  // Same set and base (`dev`) as the PR the branch will open.
  [CONTEXTS.TASK_BRANCH_PUSH]: TASK_PR_JOBS,
  // Coverage is mandatory on PRs to `dev` (Requirements 020/113): soft-skipping
  // left merges green while the post-merge `dev-push` coverage job failed
  // (JUM-918 → JUM-922). Sonar reliability-A still rides inside this job.
  [CONTEXTS.TASK_PR_TO_DEV]: TASK_PR_JOBS,
  // `dev` is the head of the release PR to `main`, which reuses this SHA's
  // statuses (PR #685), so a `dev` push runs the release set.
  [CONTEXTS.DEV_PUSH]: RELEASE_JOBS,
  [CONTEXTS.RELEASE_PR_TO_MAIN]: RELEASE_JOBS,
  // `main` is never a PR head; browser-matrix gates PRs only.
  [CONTEXTS.MAIN_PUSH]: FULL_JOBS,
  // Scheduled/manual runs land on `dev` too, so they carry its release set.
  [CONTEXTS.SCHEDULED_FULL]: RELEASE_JOBS
});

function normalizeRef(value) {
  return String(value || '').trim();
}

function truthy(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function isScheduled(env = process.env) {
  return truthy(env.JUMENTIX_CI_FORCE_FULL)
    || truthy(env.JUMENTIX_CI_SCHEDULED_FULL)
    || normalizeRef(env.GITHUB_EVENT_NAME) === 'schedule'
    || normalizeRef(env.GITHUB_EVENT_NAME) === 'workflow_dispatch'
    || normalizeRef(env.CIRCLE_SCHEDULE_NAME) !== ''
    || normalizeRef(env.CIRCLE_PIPELINE_TRIGGER_SOURCE) === 'scheduled_pipeline';
}

function isPullRequest(env = process.env) {
  return truthy(env.AAA_CI_IS_PULL_REQUEST)
    || truthy(env.JUMENTIX_CI_IS_PULL_REQUEST)
    || normalizeRef(env.CIRCLE_PULL_REQUEST) !== ''
    || normalizeRef(env.CI_PULL_REQUEST) !== '';
}

function resolveHeadRef(env = process.env) {
  return normalizeRef(
    env.JUMENTIX_PR_HEAD_REF
      || env.AAA_PR_HEAD_REF
      || env.CIRCLE_BRANCH
      || env.GITHUB_HEAD_REF
      || env.GITHUB_REF_NAME
      || env.BRANCH_NAME
  );
}

function resolveBaseRef(env = process.env) {
  return normalizeRef(
    env.JUMENTIX_PR_BASE_REF
      || env.AAA_PR_BASE_REF
      || env.CIRCLE_PR_BASE_BRANCH
      || env.GITHUB_BASE_REF
      || env.JUMENTIX_QUALITY_GATE_TARGET
  );
}

function readChangedFiles(baseRef, options = {}) {
  const spawn = options.spawn || spawnSync;
  const cwd = options.cwd || process.cwd();
  if (!baseRef) return [];

  const result = spawn('git', ['diff', '--name-only', '--diff-filter=ACMR', `${baseRef}...HEAD`], {
    cwd,
    encoding: 'utf8'
  });
  if (result.status !== 0) return [];
  return [...new Set(String(result.stdout || '')
    .split('\n')
    .map((file) => file.trim().replace(/\\/g, '/'))
    .filter(Boolean))];
}

function resolveDiffBaseRef(baseRef) {
  if (baseRef === 'dev' || baseRef === 'main') return `origin/${baseRef}`;
  return baseRef;
}

function selectedJobsFor(context) {
  return [...(JOBS_BY_CONTEXT[context] || [])];
}

function isSignedDevPromotionBranch(headRef) {
  return /^codex\/release\/[A-Z0-9-]+-dev-main-signed-squash$/i.test(String(headRef || '').trim());
}

function isGeneratedChangelogSyncBranch(headRef) {
  return /^chore\/changelog-sync-[0-9a-f]{8}$/i.test(String(headRef || '').trim());
}

/** Signed package content-bump branches opened by `package-content-bump.yml` (JUM-917). */
function isGeneratedPackageBumpBranch(headRef) {
  return /^chore\/package-bump-[0-9a-f]{8}(?:-\d+)*$/i.test(String(headRef || '').trim());
}

/** Signed app-release bump branches opened by `create-app-release-tag.js --github-api`. */
function isGeneratedAppReleaseBranch(headRef) {
  return /^chore\/release-v\d+\.\d+\.\d+$/i.test(String(headRef || '').trim());
}

/**
 * Dependabot version/security update branches (`dependabot/<ecosystem>/...`).
 * Security updates always open against the default branch (`main`); version
 * updates respect `target-branch: dev` in `.github/dependabot.yml`.
 */
function isDependabotBranch(headRef) {
  return /^dependabot\//i.test(String(headRef || '').trim());
}

function isReleasePromotionHead(headRef) {
  return headRef === 'dev'
    || isSignedDevPromotionBranch(headRef)
    || isGeneratedChangelogSyncBranch(headRef)
    || isGeneratedPackageBumpBranch(headRef)
    || isGeneratedAppReleaseBranch(headRef)
    || isDependabotBranch(headRef);
}

/**
 * Jobs that a pull request opened from `headRef` would require.
 *
 * CircleCI reports a halted job as `ci/circleci: <job>` = success on the head
 * SHA, and opening a PR starts no new pipeline. So a push pipeline that halts
 * one of these jobs leaves a green the PR's branch protection accepts without
 * the suite having run (PR #693 to `dev`; PRs #685 and #691 to `main`).
 * Outside a PR context a push runs them (JOBS_BY_CONTEXT); any it does not
 * select fails, never halts (Requirement 113 rule 14).
 */
function pullRequestJobsForHead(headRef) {
  if (!headRef || headRef === 'main') return [];
  // Release heads (and Dependabot, whose security updates target `main`) take
  // the release set, which already contains every job a PR to `dev` requires.
  return selectedJobsFor(isReleasePromotionHead(headRef)
    ? CONTEXTS.RELEASE_PR_TO_MAIN
    : CONTEXTS.TASK_PR_TO_DEV);
}

/**
 * The base branch the pull request from `headRef` will target, so a push can
 * run that PR's suites against the same base (Requirement 086 §9–10). Empty
 * when it cannot be known: `main` is never a head, and Dependabot opens version
 * updates to `dev` but security updates to `main`.
 */
function impliedPullRequestBase(headRef) {
  if (!headRef || headRef === 'main' || isDependabotBranch(headRef)) return '';
  return isReleasePromotionHead(headRef) ? 'main' : 'dev';
}

function classifyCiContext(options = {}) {
  const env = options.env || process.env;
  const cwd = options.cwd || process.cwd();
  const pullRequest = isPullRequest(env);
  const headRef = resolveHeadRef(env);
  let baseRef = resolveBaseRef(env);
  let context;

  if (isScheduled(env)) {
    context = CONTEXTS.SCHEDULED_FULL;
    baseRef = baseRef || 'main';
  } else if (pullRequest) {
    if (!baseRef) {
      throw new Error('[ci-context] pull request context is missing the base branch');
    }
    if (baseRef === 'main' && isReleasePromotionHead(headRef)) {
      context = CONTEXTS.RELEASE_PR_TO_MAIN;
    } else if (baseRef === 'dev') {
      context = CONTEXTS.TASK_PR_TO_DEV;
    } else if (baseRef === 'main') {
      throw new Error('[ci-context] only dev may open release pull requests to main');
    } else {
      throw new Error(`[ci-context] unsupported pull request base branch: ${baseRef}`);
    }
  } else if (headRef === 'main') {
    context = CONTEXTS.MAIN_PUSH;
    baseRef = baseRef || 'origin/main';
  } else if (headRef === 'dev') {
    context = CONTEXTS.DEV_PUSH;
    baseRef = baseRef || 'origin/dev';
  } else {
    context = CONTEXTS.TASK_BRANCH_PUSH;
    baseRef = baseRef || 'origin/dev';
  }

  const selectedJobs = selectedJobsFor(context);
  const diffBaseRef = resolveDiffBaseRef(baseRef);
  return {
    schemaVersion: 1,
    context,
    isPullRequest: pullRequest,
    headRef,
    baseRef,
    diffBaseRef,
    selectedJobs,
    pullRequestRequiredJobs: pullRequest ? [] : pullRequestJobsForHead(headRef),
    changedFiles: readChangedFiles(diffBaseRef, { ...options, cwd })
  };
}

function writeEvidence(evidence, resultFile) {
  if (!resultFile) return;
  const absolutePath = path.resolve(resultFile);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(evidence, null, 2)}\n`);
}

function jobSelected(evidence, jobName) {
  return evidence.selectedJobs.includes(jobName);
}

function parseArgs(argv) {
  const args = { resultFile: process.env.JUMENTIX_CI_CONTEXT_RESULT_FILE || '', requireJob: '' };
  for (let index = 2; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === '--result-file') {
      args.resultFile = argv[index + 1] || '';
      index += 1;
    } else if (current === '--require-job') {
      args.requireJob = argv[index + 1] || '';
      index += 1;
    }
  }
  return args;
}

function runCli(argv = process.argv, env = process.env) {
  const args = parseArgs(argv);
  let evidence;
  try {
    evidence = classifyCiContext({ env });
  } catch (error) {
    console.error(error.message);
    return 1;
  }

  writeEvidence(evidence, args.resultFile);
  console.log(JSON.stringify(evidence, null, 2));

  if (args.requireJob && !jobSelected(evidence, args.requireJob)) {
    if (evidence.pullRequestRequiredJobs.includes(args.requireJob)) {
      console.error(
        `[ci-context] ${args.requireJob} is required on pull requests from ${evidence.headRef}, `
        + `but no open pull request was resolved for this ${evidence.context} pipeline. `
        + 'Failing instead of halting: a halted job reports success and would satisfy the '
        + 'required check without running its suite (Requirement 113 §12). '
        + 'Open the pull request, then re-run this workflow.'
      );
      return 1;
    }
    console.log(`[ci-context] job skipped for ${evidence.context}: ${args.requireJob}`);
    return 78;
  }

  return 0;
}

if (isEntryPoint(module)) {
  process.exitCode = runCli();
}

module.exports = {
  CONTEXTS,
  FULL_JOBS,
  JOBS_BY_CONTEXT,
  classifyCiContext,
  isPullRequest,
  isDependabotBranch,
  isGeneratedChangelogSyncBranch,
  isGeneratedPackageBumpBranch,
  impliedPullRequestBase,
  isGeneratedAppReleaseBranch,
  isScheduled,
  jobSelected,
  parseArgs,
  pullRequestJobsForHead,
  readChangedFiles,
  resolveDiffBaseRef,
  resolveBaseRef,
  resolveHeadRef,
  runCli,
  selectedJobsFor,
  writeEvidence
};
