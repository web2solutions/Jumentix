/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const UNIT_TEST_PATH = /(^|\/)test\/unit\/.*\.(test|spec)\.[cm]?[jt]sx?$/;
const IMPLEMENTATION_PATH = /^(ci-cd\/|apps\/[^/]+\/(src|scripts)\/|packages\/[^/]+\/src\/|tooling\/|\.husky\/|\.github\/|\.circleci\/|package\.json$)/;
const DOCUMENTATION_PATH = /(^|\/)(documentation\/|\.agents\/)|(^|\/)(README|CHANGELOG|CLAUDE|GROK|AGENTS)(\.[^/]*)?\.md$|\.md$/i;
const WEBSITE_PATH = /^apps\/jumentix-website\//;

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
  const websiteFiles = changedFiles.filter((file) => WEBSITE_PATH.test(file));
  const relatedFiles = changedFiles.filter(
    (file) => IMPLEMENTATION_PATH.test(file) && !WEBSITE_PATH.test(file) && !UNIT_TEST_PATH.test(file)
  );

  if (websiteFiles.length > 0) {
    return {
      type: 'website-quality-gate',
      files: websiteFiles,
      unitTests,
      relatedFiles
    };
  }

  if (unitTests.length > 0) {
    return { type: 'changed-unit-tests', files: unitTests };
  }

  const implementationFiles = changedFiles.filter((file) => IMPLEMENTATION_PATH.test(file));
  if (implementationFiles.length > 0) {
    return { type: 'related-unit-tests', files: implementationFiles };
  }

  const documentationFiles = changedFiles.filter((file) => DOCUMENTATION_PATH.test(file));
  if (documentationFiles.length > 0 && documentationFiles.length === changedFiles.length) {
    return { type: 'documentation-validation', files: documentationFiles };
  }

  return { type: 'unsupported-change-set', files: changedFiles };
}

function validateDocumentationFiles(files, rootDir = process.cwd()) {
  if (!Array.isArray(files) || files.length === 0) return 1;

  for (const file of files) {
    const absolutePath = path.resolve(rootDir, file);
    if (!fs.existsSync(absolutePath)) return 1;
    const contents = fs.readFileSync(absolutePath, 'utf8');
    if (!contents.trim() || /^(<<<<<<<|=======|>>>>>>>)/m.test(contents)) return 1;
  }
  return 0;
}

function executeTaskTestPlan(plan) {
  if (plan.type === 'documentation-validation') {
    return validateDocumentationFiles(plan.files);
  }
  if (plan.type === 'unsupported-change-set') return 1;

  if (plan.type === 'website-quality-gate') {
    const websiteCommands = [
      ['--filter', '@jumentix/website', 'run', 'storybook:build'],
      ['--filter', '@jumentix/website', 'run', 'storybook:smoke'],
      ['--filter', '@jumentix/website', 'run', 'test:prepublish']
    ];

    for (const args of websiteCommands) {
      const websiteResult = spawnSync('pnpm', args, {
        stdio: 'inherit',
        env: { ...process.env }
      });
      if (websiteResult.status !== 0) return Number(websiteResult.status ?? 1);
    }

    if (plan.unitTests.length > 0) {
      const unitResult = spawnSync(
        'pnpm',
        ['exec', 'jest', '--runInBand', '--coverage=false', ...plan.unitTests],
        { stdio: 'inherit', env: { ...process.env } }
      );
      if (unitResult.status !== 0) return Number(unitResult.status ?? 1);
    }

    if (plan.relatedFiles.length === 0) return 0;
    const relatedResult = spawnSync(
      'pnpm',
      ['exec', 'jest', '--runInBand', '--coverage=false', '--findRelatedTests', ...plan.relatedFiles],
      { stdio: 'inherit', env: { ...process.env } }
    );
    return Number.isInteger(relatedResult.status) ? relatedResult.status : 1;
  }

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
    status = execute(plan);
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
  DOCUMENTATION_PATH,
  UNIT_TEST_PATH,
  WEBSITE_PATH,
  createTaskTestPlan,
  executeTaskTestPlan,
  normalizeFiles,
  readChangedFiles,
  runTaskChangeTests,
  validateDocumentationFiles,
  writeTaskTestEvidence
};
