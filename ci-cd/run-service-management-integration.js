/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const CANDIDATE_TEST_DIRS = [
  'apps/backend-template/test/integration/ServiceManagement',
  'test/integration/ServiceManagement'
];

function run() {
  const root = process.cwd();
  const testDir = CANDIDATE_TEST_DIRS.find((target) => fs.existsSync(path.join(root, target)));

  if (!testDir) {
    console.error('[ci] service-management integration: no test directories found.');
    console.error(`[ci] expected one of: ${CANDIDATE_TEST_DIRS.join(', ')}`);
    process.exit(1);
  }

  console.log(`[ci] service-management integration target: ${testDir}`);

  const result = spawnSync('jest', [testDir, '--runInBand'], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'dev' }
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

run();
