#!/usr/bin/env bun
/* eslint-disable no-console */
/**
 * Standalone contract-test gate (JUM-440): OAS route resolution + serverless handlers.
 * Populates the contracts layer as a first-class gate cell.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const CONTRACT_CHECKS = Object.freeze([
  { id: 'oas-routes', script: 'oas:check-routes' },
  { id: 'serverless-handlers', script: 'serverless:check-handlers' }
]);

function runContractTests(options = {}) {
  const logger = options.logger || console;
  const spawn = options.spawn || spawnSync;
  const root = options.root || process.cwd();
  const failures = [];
  const results = [];

  for (const check of options.checks || CONTRACT_CHECKS) {
    logger.log(`[ci] contract check: ${check.id} (${check.script})`);
    const result = spawn('bun', ['run', check.script], {
      stdio: 'inherit',
      env: { ...process.env, ...(options.env || {}) }
    });
    const status = Number.isInteger(result.status) ? result.status : 1;
    results.push({ id: check.id, script: check.script, status });
    if (status !== 0) failures.push({ id: check.id, status });
  }

  const evidence = {
    schemaVersion: 1,
    gate: 'contract-tests',
    checks: results,
    outcome: failures.length === 0 ? 'passed' : 'failed',
    generatedAt: new Date().toISOString()
  };

  const outDir = path.join(root, 'artifacts', 'ci');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'contract-tests.json'),
    `${JSON.stringify(evidence, null, 2)}\n`
  );

  return evidence;
}

if (require.main === module) {
  const evidence = runContractTests();
  if (evidence.outcome !== 'passed') process.exitCode = 1;
}

module.exports = { CONTRACT_CHECKS, runContractTests };
