/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const UNIT_TEST_PATH = /(^|\/)test\/unit\/.*\.(test|spec)\.[cm]?[jt]sx?$/;
const IMPLEMENTATION_PATH = /^(ci-cd\/|apps\/[^/]+\/(src|scripts)\/|packages\/[^/]+\/src\/|tooling\/|\.husky\/|\.github\/|\.circleci\/|package\.json$)/;

function normalizeFiles(files) {
  return [...new Set((files || [])
    .map((file) => String(file || '').trim().replace(/\\/g, '/'))
    .filter(Boolean))];
}

function readChangedFiles(options = {}) {
  const mode = options.mode || process.env.JUMENTIX_TASK_TEST_MODE || 'staged';
  const baseRef = options.baseRef || process.env.JUMENTIX_TASK_TEST_BASE || 'origin/dev';
  const args = mode === 'staged'
    ? ['diff', '--cached', '--name-only', '--diff-filter=ACMR']
    : ['diff', '--name-only', '--diff-filter=ACMR', `${baseRef}...HEAD`];
  const result = (options.spawn || spawnSync)('git', args, { encoding: 'utf8' });

  if (result.status !== 0) {
    throw new Error(`Unable to read changed files for task test gate (${mode}).`);
  }

  return normalizeFiles(String(result.stdout || '').split('\n'));
}

function createTaskTestPlan(files) {
  const changedFiles = normalizeFiles(files);
  const unitTests = changedFiles.filter((file) => UNIT_TEST_PATH.test(file));

  if (unitTests.length > 0) {
    return { type: 'changed-unit-tests', files: unitTests };
  }

  const implementationFiles = changedFiles.filter((file) => IMPLEMENTATION_PATH.test(file));
  if (implementationFiles.length > 0) {
    return { type: 'related-unit-tests', files: implementationFiles };
  }

  return { type: 'not-applicable', files: [] };
}

function executeTaskTestPlan(plan) {
  if (plan.type === 'not-applicable') return 0;

  const args = plan.type === 'changed-unit-tests'
    ? ['exec', 'jest', '--runInBand', '--coverage=false', ...plan.files]
    : ['exec', 'jest', '--runInBand', '--coverage=false', '--findRelatedTests', ...plan.files];
  const result = spawnSync('pnpm', args, { stdio: 'inherit', env: { ...process.env } });

  return Number.isInteger(result.status) ? result.status : 1;
}

function writeTaskTestEvidence(evidence, resultFile) {
  if (!resultFile) return;

  const absolutePath = path.resolve(resultFile);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(evidence, null, 2)}\n`);
}

function runTaskChangeTests(options = {}) {
  const logger = options.logger || console;
  const changedFiles = normalizeFiles(options.files || readChangedFiles(options));
  const plan = options.plan || createTaskTestPlan(changedFiles);
  const execute = options.execute || executeTaskTestPlan;
  const resultFile = options.resultFile ?? process.env.AAA_CI_GATE_RESULT_FILE;

  logger.log(`[ci] task-change test plan: ${plan.type}`);
  logger.log(`[ci] changed files considered: ${String(changedFiles.length)}`);

  let status = 1;
  try {
    status = plan.type === 'not-applicable' ? 0 : execute(plan);
    status = Number.isInteger(status) && status >= 0 ? status : 1;
  } catch (error) {
    logger.error(`[ci] task-change test gate crashed: ${plan.type}`);
    logger.error(error);
    status = 1;
  }

  const evidence = {
    schemaVersion: 1,
    gate: 'task-change-tests',
    plan: plan.type,
    changedFiles,
    selectedFiles: plan.files,
    outcome: status === 0 ? 'passed' : 'failed',
    status
  };

  writeTaskTestEvidence(evidence, resultFile);
  return evidence;
}

if (require.main === module) {
  const evidence = runTaskChangeTests();
  if (evidence.outcome !== 'passed') {
    process.exitCode = 1;
  }
}

module.exports = {
  IMPLEMENTATION_PATH,
  UNIT_TEST_PATH,
  createTaskTestPlan,
  executeTaskTestPlan,
  normalizeFiles,
  readChangedFiles,
  runTaskChangeTests,
  writeTaskTestEvidence
};
