#!/usr/bin/env bun
/* eslint-disable no-console */
/**
 * Nightly/release tier runner (JUM-498).
 * Executes suites with tier=nightly from test-map.json plus explicit redis/db targets.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { readTestMap } = require('./lib/test-map');
const { runViaPackageScript } = require('./lib/suite-runner');

const DEFAULT_NIGHTLY_SCRIPTS = Object.freeze([
  'test:integration:mutex',
  'test:integration:realtime:redis-streams',
  'test:smoke:db:all'
]);

function nightlyScriptsFromManifest(manifest) {
  const scripts = new Set();
  for (const suite of manifest.suites || []) {
    if (suite.tier !== 'nightly') continue;
    if (suite.script) scripts.add(suite.script);
  }
  for (const script of DEFAULT_NIGHTLY_SCRIPTS) scripts.add(script);
  return [...scripts];
}

function runNightlyTier(options = {}) {
  const root = options.root || path.resolve(__dirname, '..');
  const logger = options.logger || console;
  const manifest = options.manifest || readTestMap(path.join(root, 'test-map.json'));
  const scripts = options.scripts || nightlyScriptsFromManifest(manifest);
  const failures = [];
  const results = [];

  logger.log(`[ci] nightly tier starting (${scripts.length} scripts)`);
  for (const script of scripts) {
    logger.log(`\n[ci] nightly target: ${script}`);
    const status = (options.execute || runViaPackageScript)(script, {
      env: {
        RUN_REDIS_INTEGRATION: '1',
        RUN_DB_SMOKE: '1',
        ...(options.env || {})
      }
    });
    results.push({ script, status });
    if (status !== 0) failures.push({ script, status });
  }

  const evidence = {
    schemaVersion: 1,
    gate: 'nightly-tier',
    scripts,
    results,
    outcome: failures.length === 0 ? 'passed' : 'failed',
    generatedAt: new Date().toISOString()
  };

  const outDir = path.join(root, 'artifacts', 'ci');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = options.resultFile || path.join(outDir, 'nightly-tier.json');
  fs.writeFileSync(outPath, `${JSON.stringify(evidence, null, 2)}\n`);
  logger.log(`[ci] nightly evidence → ${outPath}`);

  return evidence;
}

if (require.main === module) {
  const evidence = runNightlyTier();
  if (evidence.outcome !== 'passed') process.exitCode = 1;
}

module.exports = {
  DEFAULT_NIGHTLY_SCRIPTS,
  nightlyScriptsFromManifest,
  runNightlyTier
};
