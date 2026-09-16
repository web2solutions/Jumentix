/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { isEntryPoint } = require('./lib/entry-point.js');

const CANDIDATE_TEST_DIRS = [
  'apps/service-management-api/test/integration',
  'apps/backend-template/test/integration/ServiceManagement',
  'test/integration/ServiceManagement'
];

const TEST_FILE_PATTERN = /\.(test|spec)\.[jt]s$/;

/**
 * Recursively collects runnable test files under `directory`.
 *
 * The suite must fail closed when it discovers nothing (JUM-466, JUM-557):
 * a smoke that silently runs zero tests produces confidence without evidence.
 */
function discoverTestFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  const found = [];
  const walk = (current) => {
    fs.readdirSync(current, { withFileTypes: true }).forEach((entry) => {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        return;
      }
      if (TEST_FILE_PATTERN.test(entry.name)) {
        found.push(fullPath);
      }
    });
  };
  walk(directory);
  return found;
}

function runServiceManagementIntegration(options = {}) {
  const root = options.root || process.cwd();
  const exists = options.exists || fs.existsSync;
  const spawn = options.spawn || spawnSync;
  const discover = options.discover || discoverTestFiles;
  const logger = options.logger || console;
  const testDirs = CANDIDATE_TEST_DIRS.filter((target) => exists(path.join(root, target)));

  if (testDirs.length === 0) {
    logger.error('[ci] service-management integration: no test directories found.');
    logger.error(`[ci] expected at least one of: ${CANDIDATE_TEST_DIRS.join(', ')}`);
    return 1;
  }

  logger.log(`[ci] service-management integration targets: ${testDirs.join(', ')}`);

  const testFiles = testDirs.flatMap((testDir) => discover(path.join(root, testDir)));
  if (testFiles.length === 0) {
    logger.error(`[ci] service-management integration: no test files discovered in ${testDirs.join(', ')}.`);
    logger.error('[ci] failing closed: a smoke suite that runs nothing is a false green (JUM-557).');
    return 1;
  }

  logger.log(`[ci] service-management integration: ${String(testFiles.length)} test file(s) discovered.`);

  const result = spawn('jest', [...testDirs, '--runInBand', '--coverage=false'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV || 'dev',
      // Invoked outside a package script the workspace `node_modules/.bin` is
      // not on PATH, and the bare `jest` lookup fails before a single test
      // runs — which reads as a broken suite rather than a broken PATH. Pin the
      // resolution instead of depending on the caller's environment.
      PATH: `${path.join(root, 'node_modules', '.bin')}${path.delimiter}${process.env.PATH || ''}`
    }
  });

  return result.status === 0 ? 0 : (result.status || 1);
}

if (isEntryPoint(module)) {
  process.exitCode = runServiceManagementIntegration();
}

module.exports = {
  CANDIDATE_TEST_DIRS,
  TEST_FILE_PATTERN,
  discoverTestFiles,
  runServiceManagementIntegration
};
