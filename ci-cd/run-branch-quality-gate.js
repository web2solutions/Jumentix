/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { isEntryPoint } = require('./lib/entry-point.js');
const { classifyCiContext, CONTEXTS } = require('./classify-ci-context.js');

/**
 * Lint runs before every gate that does not already contain it (JUM-596).
 *
 * Only `ci:gate:strict` declares a lint cell, and it is selected for release
 * promotion and `main`. The other paths — a task branch, a pull request into
 * `dev`, and a direct push to `dev` — need lint preflight here.
 *
 * It is a preflight rather than another matrix cell because it must fail before
 * the suites run. A branch whose lint is broken has nothing to learn from
 * twenty minutes of tests.
 */
const LINT_PREFLIGHT = Object.freeze({ id: 'lint', script: 'lint' });

/**
 * Test integrity runs before every gate, including the strict matrix (JUM-683).
 *
 * JUM-683 added `test:integrity` to the `ci:gate` script and stopped there. No
 * CI job runs that script: the branch gate selects `ci:gate:strict`,
 * `ci:gate:task` or `test:unit`, and none of the three contained the check. So
 * a suite that declares no assertions, asserts nothing about state, or sits
 * outside `test-map.json` reached `dev` and `main` with every required check
 * green — which is the shape Requirement 065 exists to stop, arrived at by
 * adding a guard to the one entry point CI does not use.
 *
 * It is a preflight rather than a matrix cell for the same reason lint is: it
 * reads the suites without running them, it takes seconds, and a tree whose
 * tests assert nothing has nothing to learn from running them.
 */
const TEST_INTEGRITY_PREFLIGHT = Object.freeze({ id: 'test-integrity', script: 'test:integrity' });

const FULL_MATRIX_QUALITY_GATE = Object.freeze({
  id: 'full-matrix',
  script: 'ci:gate:strict',
  // Lint is not repeated here: the strict matrix declares it as its first cell,
  // and running it twice would cost minutes to learn the same thing. Test
  // integrity is not a cell of that matrix, so it runs here.
  preflight: Object.freeze([TEST_INTEGRITY_PREFLIGHT])
});
const UNIT_QUALITY_GATE = Object.freeze({
  id: 'unit',
  script: 'test:unit',
  preflight: Object.freeze([LINT_PREFLIGHT, TEST_INTEGRITY_PREFLIGHT])
});
const TASK_QUALITY_GATE = Object.freeze({
  id: 'task-changes',
  script: 'ci:gate:task',
  preflight: Object.freeze([LINT_PREFLIGHT, TEST_INTEGRITY_PREFLIGHT])
});

function resolveTargetBranch(value = process.env.JUMENTIX_QUALITY_GATE_TARGET) {
  const branch = String(value || '').trim().toLowerCase();
  return branch || 'dev';
}

function resolvePullRequestFlag(value = process.env.AAA_CI_IS_PULL_REQUEST) {
  if (typeof value === 'boolean') return value;
  const normalized = String(value || '').trim().toLowerCase();
  if (['1', 'true', 'yes'].includes(normalized)) return true;
  if (['0', 'false', 'no'].includes(normalized)) return false;
  return Boolean(process.env.CIRCLE_PULL_REQUEST);
}

function selectQualityGate(targetBranch, options = {}) {
  if (options.context) {
    if (
      options.context === CONTEXTS.RELEASE_PR_TO_MAIN
      || options.context === CONTEXTS.MAIN_PUSH
      || options.context === CONTEXTS.SCHEDULED_FULL
    ) {
      return FULL_MATRIX_QUALITY_GATE;
    }
    if (options.context === CONTEXTS.DEV_PUSH) return UNIT_QUALITY_GATE;
    return TASK_QUALITY_GATE;
  }

  const branch = resolveTargetBranch(targetBranch);
  const isPullRequest = resolvePullRequestFlag(options.isPullRequest);
  if (branch === 'dev' && isPullRequest) return TASK_QUALITY_GATE;
  if (branch === 'main') return FULL_MATRIX_QUALITY_GATE;
  if (branch === 'dev') return UNIT_QUALITY_GATE;
  return TASK_QUALITY_GATE;
}

function executeQualityGate(gate) {
  const result = spawnSync('bun', ['run', gate.script], {
    stdio: 'inherit',
    env: { ...process.env }
  });

  return Number.isInteger(result.status) ? result.status : 1;
}

function writeGateEvidence(evidence, resultFile) {
  if (!resultFile) return;

  const absolutePath = path.resolve(resultFile);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(evidence, null, 2)}\n`);
}

function runBranchQualityGate(options = {}) {
  let ciContext = options.ciContext || null;
  const env = options.env || process.env;
  const execute = options.execute || executeQualityGate;
  const logger = options.logger || console;
  const resultFile = options.resultFile ?? process.env.JUMENTIX_CI_GATE_RESULT_FILE;
  const hasCiSignal = Boolean(
    env.CIRCLE_BRANCH
      || env.CIRCLE_PULL_REQUEST
      || env.CIRCLE_PR_BASE_BRANCH
      || env.GITHUB_BASE_REF
      || env.JUMENTIX_CI_FORCE_FULL
      || env.JUMENTIX_CI_SCHEDULED_FULL
  );
  if (!ciContext && options.useCiContext !== false && hasCiSignal) {
    try {
      ciContext = classifyCiContext({
        env,
        spawn: options.spawn,
        cwd: options.cwd || process.cwd()
      });
    } catch (error) {
      const evidence = {
        schemaVersion: 2,
        targetBranch: resolveTargetBranch(options.targetBranch || env.CIRCLE_PR_BASE_BRANCH || env.CIRCLE_BRANCH),
        isPullRequest: resolvePullRequestFlag(options.isPullRequest),
        context: null,
        selectedJobs: null,
        gate: 'context-classification',
        script: 'classify-ci-context',
        preflight: [],
        outcome: 'failed',
        status: 1,
        error: error.message
      };
      logger.error(`[ci] context classification failed: ${error.message}`);
      writeGateEvidence(evidence, resultFile);
      return evidence;
    }
  }
  const targetBranch = resolveTargetBranch(
    options.targetBranch || ciContext?.baseRef || ciContext?.headRef
  );
  const isPullRequest = ciContext?.isPullRequest ?? resolvePullRequestFlag(options.isPullRequest);
  const gate = selectQualityGate(targetBranch, {
    isPullRequest,
    context: ciContext?.context
  });
  logger.log(`[ci] target branch: ${targetBranch}`);
  if (ciContext?.context) logger.log(`[ci] context: ${ciContext.context}`);
  logger.log(`[ci] selected quality gate: ${gate.id} (${gate.script})`);

  const runStep = (step, label) => {
    try {
      const executionStatus = execute(step);
      return Number.isInteger(executionStatus) && executionStatus >= 0 ? executionStatus : 1;
    } catch (error) {
      logger.error(`[ci] ${label} crashed: ${step.id}`);
      logger.error(error);
      return 1;
    }
  };

  // Preflight first, and stop on the first failure. Recorded either way, so a
  // gate that skipped its lint cannot be read as one that passed it.
  const preflight = [];
  let status = 0;
  for (const step of gate.preflight || []) {
    logger.log(`[ci] preflight: ${step.id} (${step.script})`);
    const stepStatus = runStep(step, 'preflight');
    preflight.push({ id: step.id, script: step.script, status: stepStatus });
    if (stepStatus !== 0) {
      status = stepStatus;
      logger.error(`[ci] preflight failed: ${step.id} — not running ${gate.id}`);
      break;
    }
  }

  if (status === 0) {
    status = runStep(gate, 'branch quality gate');
  }

  const evidence = {
    schemaVersion: 2,
    targetBranch,
    isPullRequest,
    context: ciContext?.context || null,
    selectedJobs: ciContext?.selectedJobs || null,
    gate: gate.id,
    script: gate.script,
    preflight,
    outcome: status === 0 ? 'passed' : 'failed',
    status
  };

  writeGateEvidence(evidence, resultFile);
  return evidence;
}

if (isEntryPoint(module)) {
  const evidence = runBranchQualityGate();
  if (evidence.outcome !== 'passed') {
    process.exitCode = 1;
  }
}

module.exports = {
  FULL_MATRIX_QUALITY_GATE,
  TASK_QUALITY_GATE,
  UNIT_QUALITY_GATE,
  executeQualityGate,
  resolvePullRequestFlag,
  resolveTargetBranch,
  runBranchQualityGate,
  selectQualityGate,
  writeGateEvidence
};
