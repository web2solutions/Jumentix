/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { readTestMap, isQuarantined } = require('./lib/test-map');

const UNIT_DIR = 'apps/backend-template/test/unit';

function partitionUnitSuites(manifest) {
  const bunSuites = [];
  const nodeSuites = [];
  for (const suite of manifest.suites || []) {
    if (suite.type !== 'unit') continue;
    if (isQuarantined(manifest, suite.path)) {
      nodeSuites.push(suite.path);
      continue;
    }
    if (suite.runner === 'node') nodeSuites.push(suite.path);
    else bunSuites.push(suite.path);
  }
  return { bunSuites, nodeSuites };
}

function runBunUnit(suites, options = {}) {
  const spawn = options.spawn || spawnSync;
  const args = suites.length > 0 ? ['test', ...suites] : ['test', UNIT_DIR];
  console.log(`[ci] unit tests (bun:test): ${suites.length || 'directory'} target(s)`);
  const result = spawn('bun', args, {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'dev' }
  });
  return Number.isInteger(result.status) ? result.status : 1;
}

function runNodeUnit(suites, options = {}) {
  if (suites.length === 0) return 0;
  const spawn = options.spawn || spawnSync;
  console.log(`[ci] unit tests (node/jest partition): ${suites.length} target(s)`);
  const result = spawn('bunx', ['jest', '--runInBand', '--coverage=false', ...suites], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'dev' }
  });
  return Number.isInteger(result.status) ? result.status : 1;
}

function runUnitTests(options = {}) {
  const root = options.root || path.resolve(__dirname, '..');
  process.chdir(root);

  if (!fs.existsSync(path.join(root, UNIT_DIR))) {
    console.error(`[ci] unit tests: missing ${UNIT_DIR}`);
    return 1;
  }

  let manifest;
  try {
    manifest = options.manifest || readTestMap(path.join(root, 'test-map.json'));
  } catch (error) {
    console.warn(`[ci] test-map unavailable (${error.message}); falling back to bun:test directory run`);
    return runBunUnit([], options);
  }

  const { bunSuites, nodeSuites } = partitionUnitSuites(manifest);
  const bunStatus = runBunUnit(bunSuites, options);
  if (bunStatus !== 0) return bunStatus;
  return runNodeUnit(nodeSuites, options);
}

if (require.main === module) {
  process.exitCode = runUnitTests();
}

module.exports = {
  partitionUnitSuites,
  runBunUnit,
  runNodeUnit,
  runUnitTests
};
