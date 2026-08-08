/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { createLayerAwarePlan } = require('./lib/layer-resolver');
const { buildGateEvidence, validateGateEvidence, writeGateEvidence } = require('./lib/gate-evidence');
const { runSuitePaths } = require('./run-suite');
const { resolveTestRuntime } = require('./lib/test-runtime');
const { isEntryPoint } = require('./lib/entry-point.js');

const UNIT_TEST_PATH = /(^|\/)test\/unit\/.*\.(test|spec)\.[cm]?[jt]sx?$/;
const INTEGRATION_TEST_PATH = /(^|\/)test\/integration\/.*\.(test|spec)\.[cm]?[jt]sx?$/;
const IMPLEMENTATION_PATH = /^(ci-cd\/|apps\/[^/]+\/(src|scripts)\/|packages\/[^/]+\/src\/|tooling\/|\.husky\/|\.github\/|\.circleci\/|package\.json$)/;
const RELATED_SOURCE_PATH = /^(ci-cd\/.*\.[cm]?js|apps\/[^/]+\/(src|scripts)\/.*\.[cm]?[jt]sx?|packages\/[^/]+\/src\/.*\.[cm]?[jt]sx?|tooling\/.*\.[cm]?[jt]sx?)$/;
const GOVERNANCE_CONFIG_PATH = /^(\.husky\/|\.github\/|\.circleci\/)|^package\.json$/;
const GOVERNANCE_TEST_PATH = 'apps/backend-template/test/unit/ci-cd/run-full-test-matrix.test.ts';
const TOOLCHAIN_CONFIG_PATH = /^(bun\.lock|\.bun-version|package\.json)$/;
const TOOLCHAIN_TEST_PATHS = [
  'apps/backend-template/test/unit/ci-cd/check-bun-version.test.ts',
  'apps/backend-template/test/unit/ci-cd/check-dependency-override-integrity.test.ts'
];
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

function gateV2Enabled(env = process.env) {
  const raw = env.JUMENTIX_GATE_V2;
  if (raw === undefined || raw === '') return true; // default on after flip (JUM-443)
  return !['0', 'false', 'off', 'no'].includes(String(raw).toLowerCase());
}

function shadowEnabled(env = process.env) {
  const raw = env.JUMENTIX_GATE_V2_SHADOW;
  return ['1', 'true', 'on', 'yes'].includes(String(raw || '').toLowerCase());
}

function createTaskTestPlan(files) {
  const changedFiles = normalizeFiles(files);
  const unitTests = changedFiles.filter((file) => UNIT_TEST_PATH.test(file));
  const integrationTests = changedFiles.filter((file) => INTEGRATION_TEST_PATH.test(file));
  const websiteFiles = changedFiles.filter((file) => WEBSITE_PATH.test(file));
  const relatedFiles = changedFiles.filter(
    (file) => RELATED_SOURCE_PATH.test(file) && !WEBSITE_PATH.test(file)
  );
  const governanceTests = changedFiles.some((file) => GOVERNANCE_CONFIG_PATH.test(file))
    ? [GOVERNANCE_TEST_PATH]
    : [];
  const toolchainTests = changedFiles.some((file) => TOOLCHAIN_CONFIG_PATH.test(file))
    ? TOOLCHAIN_TEST_PATHS
    : [];
  const selectedUnitTests = normalizeFiles([...unitTests, ...governanceTests, ...toolchainTests]);

  if (websiteFiles.length > 0) {
    return {
      type: 'website-quality-gate',
      files: websiteFiles,
      unitTests: selectedUnitTests,
      relatedFiles
    };
  }

  if (integrationTests.length > 0) {
    return {
      type: 'changed-integration-tests',
      files: normalizeFiles([...unitTests, ...governanceTests, ...integrationTests]),
      testTimeoutMs: integrationTests.some((file) => file.includes('/Restify/')) ? 15_000 : undefined
    };
  }

  if (unitTests.length > 0) {
    return { type: 'changed-unit-tests', files: unitTests };
  }

  if (relatedFiles.length > 0) {
    return { type: 'related-unit-tests', files: relatedFiles };
  }

  if (governanceTests.length > 0) {
    return { type: 'mapped-unit-tests', files: governanceTests };
  }

  if (toolchainTests.length > 0) {
    return { type: 'mapped-unit-tests', files: toolchainTests };
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
    const websiteResult = spawnSync(process.execPath, ['run', '--filter', '@jumentix/website', 'test:prepublish'], {
      stdio: 'inherit',
      env: { ...process.env }
    });
    if (websiteResult.status !== 0) return Number(websiteResult.status ?? 1);

    if (plan.unitTests.length > 0) {
      const status = runSuitePaths(plan.unitTests, { label: 'website-unit' });
      if (status !== 0) return status;
    }

    if (plan.relatedFiles.length === 0) return 0;
    // Related-file discovery stays Jest-shaped under CI node runtime only.
    if (resolveTestRuntime() === 'node') {
      const relatedResult = spawnSync(
        'bun',
        ['x', 'jest', '--runInBand', '--coverage=false', '--findRelatedTests', ...plan.relatedFiles],
        { stdio: 'inherit', env: { ...process.env } }
      );
      return Number.isInteger(relatedResult.status) ? relatedResult.status : 1;
    }
    return runSuitePaths(plan.relatedFiles, { label: 'website-related' });
  }

  if (plan.type === 'layer-aware') {
    return executeLayerAwarePlan(plan);
  }

  if (['changed-unit-tests', 'mapped-unit-tests', 'changed-integration-tests'].includes(plan.type)) {
    return runSuitePaths(plan.files, {
      label: plan.type,
      timeoutMs: plan.testTimeoutMs
    });
  }

  // related-unit-tests: under Bun local, execute the related paths directly.
  if (resolveTestRuntime() === 'node') {
    const result = spawnSync(
      'bun',
      ['x', 'jest', '--runInBand', '--coverage=false', '--findRelatedTests', ...plan.files],
      { stdio: 'inherit', env: { ...process.env } }
    );
    return Number.isInteger(result.status) ? result.status : 1;
  }
  return runSuitePaths(plan.files, { label: plan.type });
}

/**
 * @param options.spawn Injected so the evidence bookkeeping can be tested without
 * spawning the real integration suites — which a test asserting *what was
 * recorded* has no reason to run, and which would take minutes.
 * @param options.runSuites Same, for the unit leg.
 */
function executeLayerAwarePlan(plan, options = {}) {
  const spawn = options.spawn || spawnSync;
  const runSuites = options.runSuites || runSuitePaths;
  const suiteResults = [];
  const executedSuites = [];

  if (plan.unitSuites.length > 0) {
    const runtime = resolveTestRuntime();
    const unitPaths = plan.suites.filter((suite) => suite.type === 'unit').map((s) => s.path);
    const status = runSuites(unitPaths, { label: 'layer-aware-unit', runtime });
    for (const suite of unitPaths) {
      executedSuites.push(suite);
      suiteResults.push({
        suite,
        status: status === 0 ? 'passed' : 'failed',
        runner: runtime
      });
    }
    if (status !== 0) {
      plan._execution = { executedSuites, suiteResults, status };
      return status;
    }
  }

  for (const script of plan.integrationScripts || []) {
    const result = spawn('bun', ['run', script], {
      stdio: 'inherit',
      env: { ...process.env, CI: 'true' }
    });
    const status = Number.isInteger(result.status) ? result.status : 1;
    const outcome = status === 0 ? 'passed' : 'failed';
    executedSuites.push(script);

    // Record the suite files the script covers, not only the script name.
    //
    // The plan lists integration suites by path; execution runs them through one
    // npm script per framework. Recording only the script name left
    // `validateGateEvidence` comparing paths against script names, so every
    // planned integration suite reported as "missing from executed set" — a
    // fail-closed gate failing on its own bookkeeping rather than on a test.
    //
    // It stayed hidden while no change selected an integration layer. The
    // Express 5 upgrade selected them, and forty-odd suites were reported unrun
    // immediately after passing. Contract suites (JUM-440) share the mechanics:
    // they run through `oas:check-routes` / `serverless:check-handlers`, so they
    // are recorded here too (JUM-474).
    const covered = (plan.suites || [])
      .filter((suite) => (suite.type === 'integration' || suite.type === 'contract') && suite.script === script)
      .map((suite) => suite.path);

    for (const suite of covered) {
      executedSuites.push(suite);
      suiteResults.push({ suite, status: outcome, runner: 'node' });
    }

    suiteResults.push({ suite: script, status: outcome, runner: 'node' });
    if (status !== 0) {
      plan._execution = { executedSuites, suiteResults, status };
      return status;
    }
  }

  if ((plan.unitSuites.length + (plan.integrationScripts || []).length) === 0
    && plan.type === 'layer-aware'
    && (plan.files || []).length > 0) {
    plan._execution = { executedSuites, suiteResults, status: 1 };
    return 1;
  }

  plan._execution = { executedSuites, suiteResults, status: 0 };
  return 0;
}

function writeTaskTestEvidence(evidence, resultFile) {
  writeGateEvidence(evidence, resultFile);
}

function runTaskChangeTests(options = {}) {
  const logger = options.logger || console;
  const env = options.env || process.env;
  const changedFiles = normalizeFiles(options.files || readChangedFiles(options));
  const useV2 = options.forceV2 !== undefined ? options.forceV2 : gateV2Enabled(env);
  const useShadow = options.forceShadow !== undefined ? options.forceShadow : shadowEnabled(env);
  const resultFile = options.resultFile ?? env.JUMENTIX_CI_GATE_RESULT_FILE;

  const v1Plan = createTaskTestPlan(changedFiles);
  let plan = v1Plan;
  let shadow = null;

  if (useV2 || useShadow) {
    const v2Plan = createLayerAwarePlan(changedFiles, options);
    if (useShadow && !useV2) {
      shadow = {
        mode: 'report-only',
        v1Plan: v1Plan.type,
        v2Plan: v2Plan.type,
        v2SelectedLayers: v2Plan.selectedLayers || [],
        v2PlannedSuites: (v2Plan.suites || []).map((suite) => suite.path || suite)
      };
      plan = v1Plan;
      logger.log('[ci] GATE_V2 shadow mode active — v1 authoritative, v2 report-only');
    } else {
      plan = v2Plan;
      logger.log('[ci] GATE_V2 enabled — layer-aware selector authoritative');
    }
  }

  logger.log(`[ci] task-change test plan: ${plan.type}`);
  logger.log(`[ci] changed files considered: ${String(changedFiles.length)}`);

  const execute = options.execute || executeTaskTestPlan;
  let status = 1;
  try {
    status = execute(plan);
    status = Number.isInteger(status) && status >= 0 ? status : 1;
  } catch (error) {
    logger.error(`[ci] task-change test gate crashed: ${plan.type}`);
    logger.error(error);
    status = 1;
  }

  let evidence;
  if (plan.type === 'layer-aware') {
    const execution = plan._execution || {
      executedSuites: plan.unitSuites || [],
      suiteResults: [],
      status
    };
    evidence = buildGateEvidence(plan, {
      gateVersion: 'v2',
      executedSuites: execution.executedSuites,
      suiteResults: execution.suiteResults,
      status,
      outcome: status === 0 ? 'passed' : 'failed',
      shadow
    });
    const validation = validateGateEvidence({
      ...evidence,
      outcome: plan.type === 'documentation-validation' ? 'not-applicable' : evidence.outcome
    });
    if (!validation.ok && status === 0) {
      logger.error('[ci] layer-aware evidence failed closed validation:');
      for (const error of validation.errors) logger.error(` - ${error}`);
      status = 1;
      evidence.status = 1;
      evidence.outcome = 'failed';
      evidence.validationErrors = validation.errors;
    }
  } else {
    evidence = {
      schemaVersion: 1,
      gate: 'task-change-tests',
      gateVersion: useV2 ? 'v2-fallback' : 'v1',
      plan: plan.type,
      changedFiles,
      selectedFiles: plan.files,
      outcome: status === 0
        ? (plan.type === 'documentation-validation' ? 'not-applicable' : 'passed')
        : 'failed',
      status,
      shadow
    };
  }

  writeTaskTestEvidence(evidence, resultFile);
  return evidence;
}

if (isEntryPoint(module)) {
  const evidence = runTaskChangeTests();
  if (!['passed', 'not-applicable'].includes(evidence.outcome)) {
    process.exitCode = 1;
  }
}

module.exports = {
  GOVERNANCE_CONFIG_PATH,
  GOVERNANCE_TEST_PATH,
  IMPLEMENTATION_PATH,
  INTEGRATION_TEST_PATH,
  RELATED_SOURCE_PATH,
  DOCUMENTATION_PATH,
  UNIT_TEST_PATH,
  WEBSITE_PATH,
  createTaskTestPlan,
  executeTaskTestPlan,
  executeLayerAwarePlan,
  gateV2Enabled,
  normalizeFiles,
  readChangedFiles,
  runTaskChangeTests,
  shadowEnabled,
  validateDocumentationFiles,
  writeTaskTestEvidence
};
