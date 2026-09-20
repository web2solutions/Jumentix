#!/usr/bin/env bun
/* eslint-disable no-console */
/**
 * Runs the dead-letter Redis integration suite against docker-compose-redis.
 *
 * JUM-53. Shares `passwordFromCompose` with the key-value runner rather than
 * copying it: the reason that function exists — keeping the local requirepass
 * out of package.json, where gitleaks finds it — applies identically here.
 */
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { isEntryPoint } = require('../../../ci-cd/lib/entry-point.js');
const { passwordFromCompose } = require('./run-redis-key-value-integration.js');

const ROOT = process.cwd();

function run() {
  const env = { ...process.env, NODE_ENV: 'dev', RUN_REDIS_INTEGRATION: '1' };
  if (!env.JUMENTIX_REDIS_PASSWORD) {
    env.JUMENTIX_REDIS_PASSWORD = env.AAA_REDIS_PASSWORD || passwordFromCompose();
  }

  const result = spawnSync(
    process.execPath,
    [
      path.join(ROOT, 'ci-cd/run-suite.js'),
      '--script-label',
      'dead-letter',
      'packages/dead-letter-queue/test/integration'
    ],
    { cwd: ROOT, env, stdio: 'inherit' }
  );

  if (result.error) throw result.error;
  return typeof result.status === 'number' ? result.status : 1;
}

if (isEntryPoint(module)) {
  process.exit(run());
}

module.exports = { run };
