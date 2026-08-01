/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { isEntryPoint } = require('./lib/entry-point.js');

const FULL_MATRIX_QUALITY_GATE = Object.freeze({
  id: 'full-matrix',
  script: 'ci:gate:strict'
});
const UNIT_QUALITY_GATE = Object.freeze({
  id: 'unit',
  script: 'test:unit'
});
const TASK_QUALITY_GATE = Object.freeze({
  id: 'task-changes',
  script: 'ci:gate:task'
});

function resolveTargetBranch(value = process.env.JUMENTIX_QUALITY_GATE_TARGET) {
  const branch = String(value || '').trim().toLowerCase();
  return branch || 'dev';
}

function selectQualityGate(targetBranch) {
  const branch = resolveTargetBranch(targetBranch);
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
  const gate = selectQualityGate(targetBranch);
  const execute = options.execute || executeQualityGate;
  const logger = options.logger || console;
  const resultFile = options.resultFile ?? process.env.AAA_CI_GATE_RESULT_FILE;

  logger.log(`[ci] target branch: ${targetBranch}`);
  logger.log(`[ci] selected quality gate: ${gate.id} (${gate.script})`);

  let status = 1;
  try {
    const executionStatus = execute(gate);
    status = Number.isInteger(executionStatus) && executionStatus >= 0
      ? executionStatus
      : 1;
  } catch (error) {
    logger.error(`[ci] branch quality gate crashed: ${gate.id}`);
    logger.error(error);
  }

  const evidence = {
    schemaVersion: 1,
    targetBranch,
    gate: gate.id,
    script: gate.script,
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
  resolveTargetBranch,
  runBranchQualityGate,
  selectQualityGate,
  writeGateEvidence
};
