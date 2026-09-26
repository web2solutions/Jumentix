/* eslint-disable no-console */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const CANDIDATE_SECURITY_ROOTS = ['apps/backend-template/test/unit', 'test/unit'];
const SECURITY_TEST_SUFFIXES = ['config/security.test.ts', 'shared/utils.errorExposure.test.ts'];

function run() {
  const root = process.cwd();
  const existingTests = CANDIDATE_SECURITY_ROOTS.reduce((found, candidateRoot) => {
    if (found.length > 0) {
      return found;
    }

    if (!fs.existsSync(path.join(root, candidateRoot))) {
      return found;
    }

    const testsForRoot = SECURITY_TEST_SUFFIXES.map((suffix) =>
      path.join(candidateRoot, suffix)
    ).filter((target) => fs.existsSync(path.join(root, target)));

    return testsForRoot;
  }, []);

  if (existingTests.length === 0) {
    console.error('[ci] security smoke: no matching tests were found.');
    const expected = CANDIDATE_SECURITY_ROOTS.flatMap((candidateRoot) =>
      SECURITY_TEST_SUFFIXES.map((suffix) => `${candidateRoot}/${suffix}`)
    ).join(', ');
    console.error(`[ci] expected one of: ${expected}`);
    process.exitCode = 1;
    return;
  }

  console.log(`[ci] security smoke targets: ${existingTests.join(', ')}`);

  const result = spawnSync('jest', [...existingTests, '--runInBand', '--coverage=false'], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'ci' }
  });

  if (result.status !== 0) {
    process.exitCode = result.status || 1;
  }
}

run();
