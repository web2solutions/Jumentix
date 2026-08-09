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

const JOBS_BY_CONTEXT = Object.freeze({
  [CONTEXTS.TASK_BRANCH_PUSH]: Object.freeze(['branch-gate']),
  [CONTEXTS.TASK_PR_TO_DEV]: Object.freeze(['branch-gate', 'third-party-review']),
  [CONTEXTS.DEV_PUSH]: Object.freeze(['branch-gate']),
  [CONTEXTS.RELEASE_PR_TO_MAIN]: FULL_JOBS,
  [CONTEXTS.MAIN_PUSH]: FULL_JOBS,
  [CONTEXTS.SCHEDULED_FULL]: FULL_JOBS
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
    if (baseRef === 'main' && headRef === 'dev') {
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
  isScheduled,
  jobSelected,
  parseArgs,
  readChangedFiles,
  resolveDiffBaseRef,
  resolveBaseRef,
  resolveHeadRef,
  runCli,
  selectedJobsFor,
  writeEvidence
};
