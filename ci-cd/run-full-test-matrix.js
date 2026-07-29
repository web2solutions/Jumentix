/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const FULL_TEST_MATRIX = Object.freeze([
  { id: 'lint', script: 'lint' },
  { id: 'architecture-cycles', script: 'deps:check-cycles' },
  { id: 'architecture-boundaries', script: 'arch:check-boundaries' },
  { id: 'architecture-users-legacy', script: 'arch:check-users-legacy-imports' },
  { id: 'architecture-workspaces', script: 'arch:check-workspace-boundaries' },
  { id: 'workspace-quality', script: 'workspace:check-quality' },
  { id: 'workspace-coverage-policy', script: 'workspace:check-coverage-policy' },
  { id: 'release-governance', script: 'release:governance:check' },
  { id: 'pull-request-governance', script: 'pr:governance:check' },
  { id: 'requirements-registry', script: 'requirements:check' },
  { id: 'canonical-integrations', script: 'integrations:check' },
  { id: 'agent-registry', script: 'agent-registry:check' },
  { id: 'unit', script: 'test:unit' },
  { id: 'security-smoke', script: 'ci:security-smoke' },
  { id: 'openapi-routes', script: 'oas:check-routes' },
  { id: 'serverless-handlers', script: 'serverless:check-handlers' },
  { id: 'backend-build', script: 'build:dev' },
  { id: 'api-smoke', script: 'ci:smoke' },
  { id: 'workspace-builds', script: 'mono:build' },
  { id: 'workspace-tests', script: 'mono:test' },
  { id: 'website-prepublish', script: 'website:test:prepublish' },
  { id: 'integration', script: 'ci:integration' },
  { id: 'patch-coverage', script: 'coverage:patch' }
]);

function validateMatrixManifest(cells, availableScripts) {
  if (!Array.isArray(cells) || cells.length === 0) {
    throw new Error('Full test matrix must declare at least one required cell.');
  }

  const ids = new Set();
  const scripts = new Set();

  for (const cell of cells) {
    const id = String(cell?.id || '').trim();
    const script = String(cell?.script || '').trim();

    if (!id || !script) {
      throw new Error('Every full-matrix cell must declare a non-empty id and script.');
    }
    if (ids.has(id)) {
      throw new Error(`Duplicate full-matrix cell id: ${id}`);
    }
    if (scripts.has(script)) {
      throw new Error(`Duplicate full-matrix script: ${script}`);
    }
    if (!Object.prototype.hasOwnProperty.call(availableScripts, script)) {
      throw new Error(`Full-matrix script is missing from package.json: ${script}`);
    }

    ids.add(id);
    scripts.add(script);
  }
}

function executeMatrixCell(cell) {
  const result = spawnSync('pnpm', ['run', cell.script], {
    stdio: 'inherit',
    env: { ...process.env }
  });

  return Number.isInteger(result.status) ? result.status : 1;
}

function writeMatrixEvidence(result, resultFile) {
  if (!resultFile) return;

  const absolutePath = path.resolve(resultFile);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(result, null, 2)}\n`);
}

function runFullTestMatrix(options = {}) {
  const cells = options.cells || FULL_TEST_MATRIX;
  const execute = options.execute || executeMatrixCell;
  const logger = options.logger || console;
  const availableScripts = options.availableScripts || require('../package.json').scripts;
  const resultFile = options.resultFile ?? process.env.AAA_CI_MATRIX_RESULT_FILE;

  validateMatrixManifest(cells, availableScripts);

  const results = [];
  for (const cell of cells) {
    logger.log(`\n[ci] full-matrix cell: ${cell.id} (${cell.script})`);

    let status = 1;
    try {
      const executionStatus = execute(cell);
      status = Number.isInteger(executionStatus) && executionStatus >= 0
        ? executionStatus
        : 1;
    } catch (error) {
      logger.error(`[ci] full-matrix cell crashed: ${cell.id}`);
      logger.error(error);
    }

    const state = status === 0 ? 'passed' : 'failed';
    results.push({ id: cell.id, script: cell.script, state, status });
  }

  const failed = results.filter((result) => result.state !== 'passed');
  const outcome = failed.length === 0 ? 'passed' : 'failed';
  const evidence = {
    schemaVersion: 1,
    outcome,
    requiredCellCount: cells.length,
    reportedCellCount: results.length,
    results
  };

  writeMatrixEvidence(evidence, resultFile);

  if (failed.length > 0) {
    logger.error('\n[ci] full test matrix failed:');
    failed.forEach((result) => {
      logger.error(`- ${result.id} / ${result.script} (exit ${String(result.status)})`);
    });
  } else {
    logger.log(`\n[ci] full test matrix passed (${String(results.length)} cells).`);
  }

  return evidence;
}

if (require.main === module) {
  try {
    const evidence = runFullTestMatrix();
    if (evidence.outcome !== 'passed') {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error('[ci] full test matrix configuration is invalid.');
    console.error(error);
    process.exitCode = 1;
  }
}

module.exports = {
  FULL_TEST_MATRIX,
  executeMatrixCell,
  runFullTestMatrix,
  validateMatrixManifest,
  writeMatrixEvidence
};
