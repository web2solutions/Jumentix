/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { isEntryPoint } = require('./lib/entry-point.js');

const CANDIDATE_TEST_DIRS = [
  'apps/backend-template/test/integration/ServiceManagement',
  'test/integration/ServiceManagement'
];

function runServiceManagementIntegration(options = {}) {
  const root = options.root || process.cwd();
  const exists = options.exists || fs.existsSync;
  const spawn = options.spawn || spawnSync;
  const logger = options.logger || console;
  const testDir = CANDIDATE_TEST_DIRS.find((target) => exists(path.join(root, target)));

  if (!testDir) {
    logger.error('[ci] service-management integration: no test directories found.');
    logger.error(`[ci] expected one of: ${CANDIDATE_TEST_DIRS.join(', ')}`);
    return 1;
  }

  logger.log(`[ci] service-management integration target: ${testDir}`);

  const result = spawn('jest', [testDir, '--runInBand', '--coverage=false'], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'dev' }
  });

  return result.status === 0 ? 0 : (result.status || 1);
}

if (isEntryPoint(module)) {
  process.exitCode = runServiceManagementIntegration();
}

module.exports = {
  CANDIDATE_TEST_DIRS,
  runServiceManagementIntegration
};
