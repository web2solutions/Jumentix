#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Branch-gate body for generated release / changelog PRs (JUM-889).
 *
 * These PRs are opened by automation against `main`. Heavy jobs
 * (workspace-tests, coverage, integration, …) already run as selected
 * CircleCI jobs for `release-pr-to-main`. Re-running `ci:gate:strict` inside
 * `branch-gate` duplicates that surface and flakes (EADDRINUSE) block merges
 * for hours — which is how app-release spun version bumps without ever tagging.
 *
 * This script only asserts the diff is the expected automation shape.
 */
const { execFileSync } = require('child_process');
const { gitBinary } = require('./lib/git-binary.js');
const { isEntryPoint } = require('./lib/entry-point.js');
const {
  isGeneratedAppReleaseBranch,
  isGeneratedChangelogSyncBranch,
  resolveHeadRef,
  resolveBaseRef
} = require('./classify-ci-context.js');

const RELEASE_ALLOWED = new Set([
  'package.json',
  'release-policy.json'
]);

function runGit(args, options = {}) {
  try {
    return execFileSync(gitBinary(), args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', options.allowFailure ? 'ignore' : 'pipe'],
      cwd: options.cwd
    }).toString().trim();
  } catch (error) {
    if (options.allowFailure) return '';
    throw error;
  }
}

function listChangedFiles(diffBaseRef, cwd) {
  const output = runGit(
    ['diff', '--name-only', `${diffBaseRef}...HEAD`],
    { cwd, allowFailure: true }
  );
  if (!output) return [];
  return output.split('\n').map((line) => line.trim()).filter(Boolean);
}

function isAllowedReleasePath(file) {
  if (RELEASE_ALLOWED.has(file)) return true;
  return /^apps\/[^/]+\/package\.json$/.test(file);
}

function validateGeneratedAutomationPr(options = {}) {
  const env = options.env || process.env;
  const cwd = options.cwd || process.cwd();
  const headRef = options.headRef || resolveHeadRef(env);
  let baseRef = options.baseRef || resolveBaseRef(env) || 'main';
  // Generated release/changelog PRs always target `main`. On CircleCI branch-push
  // pipelines (no CIRCLE_PULL_REQUEST), resolve_pr_metadata sets
  // JUMENTIX_QUALITY_GATE_TARGET=CIRCLE_BRANCH, so resolveBaseRef collapses to the
  // head itself and `git diff head...HEAD` is empty (job 2158 / PR #522).
  if (
    (isGeneratedAppReleaseBranch(headRef) || isGeneratedChangelogSyncBranch(headRef))
    && baseRef !== 'main'
    && baseRef !== 'dev'
    && baseRef !== 'origin/main'
    && baseRef !== 'origin/dev'
  ) {
    baseRef = 'main';
  }
  const diffBaseRef = options.diffBaseRef
    || (baseRef === 'main' || baseRef === 'dev' ? `origin/${baseRef}` : baseRef);
  const changed = options.changedFiles || listChangedFiles(diffBaseRef, cwd);
  const failures = [];

  if (isGeneratedAppReleaseBranch(headRef)) {
    if (changed.length === 0) {
      failures.push('[generated-automation] release PR has an empty diff');
    }
    for (const file of changed) {
      if (!isAllowedReleasePath(file)) {
        failures.push(
          `[generated-automation] release PR must only bump version metadata; unexpected file: ${file}`
        );
      }
    }
  } else if (isGeneratedChangelogSyncBranch(headRef)) {
    const unexpected = changed.filter((file) => file !== 'CHANGELOG.md');
    if (changed.length === 0) {
      failures.push('[generated-automation] changelog PR has an empty diff');
    }
    for (const file of unexpected) {
      failures.push(
        `[generated-automation] changelog PR must only touch CHANGELOG.md; unexpected file: ${file}`
      );
    }
  } else {
    failures.push(
      `[generated-automation] head '${headRef || '(empty)'}' is not a generated automation branch`
    );
  }

  return { headRef, baseRef, changedFiles: changed, failures };
}

function main(options = {}) {
  const result = validateGeneratedAutomationPr(options);
  if (result.failures.length > 0) {
    for (const failure of result.failures) console.error(failure);
    return 1;
  }
  console.log(
    `[generated-automation] ok head=${result.headRef} files=${result.changedFiles.length}`
  );
  return 0;
}

module.exports = {
  isAllowedReleasePath,
  main,
  validateGeneratedAutomationPr
};

if (isEntryPoint(module)) {
  process.exitCode = main();
}
