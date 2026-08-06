/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { isEntryPoint } = require('./lib/entry-point.js');

/**
 * Lint runs before every gate that does not already contain it (JUM-596).
 *
 * Only `ci:gate:strict` declares a lint cell, and it is selected for `main` and
 * for pull requests into `dev`. The other two paths — a task branch, and a
 * direct push to `dev` — ran no lint at all. That is how twenty lint errors
 * reached `dev`: nothing on the way in looked.
 *
 * It is a preflight rather than another matrix cell because it must fail before
 * the suites run. A branch whose lint is broken has nothing to learn from
 * twenty minutes of tests.
 */
const LINT_PREFLIGHT = Object.freeze({ id: 'lint', script: 'lint' });

const FULL_MATRIX_QUALITY_GATE = Object.freeze({
  id: 'full-matrix',
  script: 'ci:gate:strict',
  // No preflight: the strict matrix declares `lint` as its first cell, and
  // running it twice would cost minutes to learn the same thing.
  preflight: Object.freeze([])
});
const UNIT_QUALITY_GATE = Object.freeze({
  id: 'unit',
  script: 'test:unit',
  preflight: Object.freeze([LINT_PREFLIGHT])
});
const TASK_QUALITY_GATE = Object.freeze({
  id: 'task-changes',
  script: 'ci:gate:task',
  preflight: Object.freeze([LINT_PREFLIGHT])
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
  const branch = resolveTargetBranch(targetBranch);
  const isPullRequest = resolvePullRequestFlag(options.isPullRequest);
  if (branch === 'dev' && isPullRequest) return FULL_MATRIX_QUALITY_GATE;
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
  const targetBranch = resolveTargetBranch(options.targetBranch);
  const isPullRequest = resolvePullRequestFlag(options.isPullRequest);
  const gate = selectQualityGate(targetBranch, { isPullRequest });
  const execute = options.execute || executeQualityGate;
  const logger = options.logger || console;
  const resultFile = options.resultFile ?? process.env.JUMENTIX_CI_GATE_RESULT_FILE;

  logger.log(`[ci] target branch: ${targetBranch}`);
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
