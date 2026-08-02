#!/usr/bin/env bun
/* eslint-disable no-console */
/**
 * Runs the Redis key-value integration suite against docker-compose-redis.
 *
 * The compose file already carries the local requirepass (since 2024). Putting
 * that same value into package.json scripts re-introduced it into the PR diff
 * and failed gitleaks. This runner copies the password from the compose file
 * into AAA_REDIS_PASSWORD only when the env var is unset, so package.json never
 * embeds a secret and CI can still override via secrets.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { isEntryPoint } = require('./lib/entry-point.js');

const ROOT = process.cwd();
const COMPOSE = path.join(
  ROOT,
  'apps/backend-template/docker-compose-redis.yml'
);

function passwordFromCompose(composePath = COMPOSE) {
  const contents = fs.readFileSync(composePath, 'utf8');
  const match = contents.match(/--requirepass\s+(\S+)/);
  if (!match) {
    throw new Error(
      `[redis-integration] could not read --requirepass from ${composePath}`
    );
  }
  return match[1];
}

function run() {
  const env = { ...process.env, NODE_ENV: 'dev', RUN_REDIS_INTEGRATION: '1' };
  if (!env.AAA_REDIS_PASSWORD) {
    env.AAA_REDIS_PASSWORD = passwordFromCompose();
  }

  const result = spawnSync(
    process.execPath,
    [
      path.join(ROOT, 'ci-cd/run-suite.js'),
      '--script-label',
      'key-value',
      'packages/key-value-storage/test/integration'
    ],
    { cwd: ROOT, env, stdio: 'inherit' }
  );

  if (result.error) throw result.error;
  return typeof result.status === 'number' ? result.status : 1;
}

if (isEntryPoint(module)) {
  process.exit(run());
}

module.exports = { passwordFromCompose, run };
