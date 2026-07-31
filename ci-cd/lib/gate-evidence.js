const fs = require('fs');
const path = require('path');

function buildGateEvidence(plan, execution = {}) {
  return {
    schemaVersion: 1,
    kind: 'layer-aware-task-gate',
    gateVersion: execution.gateVersion || 'v2',
    changedFiles: plan.files || [],
    selectedLayers: plan.selectedLayers || [],
    notRunLayers: (plan.notRunLayers || []).map((layer) => ({
      layer,
      reason: 'not-in-blast-radius'
    })),
    reasons: plan.reasons || {},
    plannedSuites: (plan.suites || []).map((suite) => suite.path || suite),
    executedSuites: execution.executedSuites || [],
    suiteResults: execution.suiteResults || [],
    integrationScripts: plan.integrationScripts || [],
    outcome: execution.outcome || 'unknown',
    status: Number.isInteger(execution.status) ? execution.status : 1,
    shadow: execution.shadow || null
  };
}

function validateGateEvidence(evidence) {
  const errors = [];
  if (!evidence || evidence.schemaVersion !== 1) {
    return { ok: false, errors: ['evidence.schemaVersion must be 1'] };
  }

  const changed = evidence.changedFiles || [];
  const planned = evidence.plannedSuites || [];
  const executed = evidence.executedSuites || [];
  const results = evidence.suiteResults || [];

  if (changed.length > 0 && planned.length === 0 && evidence.outcome !== 'not-applicable') {
    errors.push('empty suite list for non-empty change set');
  }

  for (const suite of planned) {
    if (!executed.includes(suite) && evidence.outcome !== 'not-applicable') {
      errors.push(`planned suite missing from executed set: ${suite}`);
    }
  }

  for (const result of results) {
    if (!result || !result.suite) {
      errors.push('suite result missing suite id');
      continue;
    }
    if (!['passed', 'failed'].includes(result.status)) {
      errors.push(`suite status not terminal green/red: ${result.suite}=${result.status}`);
    }
  }

  const executedSet = new Set(executed);
  for (const suite of planned) {
    if (!executedSet.has(suite) && evidence.outcome !== 'not-applicable') {
      errors.push(`executed set is not a superset of planned set: ${suite}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

function writeGateEvidence(evidence, resultFile) {
  if (!resultFile) return;
  const absolutePath = path.resolve(resultFile);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(evidence, null, 2)}\n`);
}

module.exports = {
  buildGateEvidence,
  validateGateEvidence,
  writeGateEvidence
};
