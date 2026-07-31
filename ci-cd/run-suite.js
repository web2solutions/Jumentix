#!/usr/bin/env bun
/* eslint-disable no-console */
/**
 * Unified suite path runner (Req 106).
 * Local → bun test <paths>
 * CI/node → jest --runInBand <paths>
 *
 * Usage:
 *   bun ci-cd/run-suite.js <path> [<path>...]
 *   bun ci-cd/run-suite.js --script-label express apps/backend-template/test/integration/Express
 */
const { spawnSync } = require('child_process');
const { resolveTestRuntime } = require('./lib/test-runtime');

function parseArgs(argv) {
  const paths = [];
  let label = null;
  let timeoutMs = null;
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--script-label') label = argv[++i];
    else if (arg === '--timeout') timeoutMs = Number(argv[++i]);
    else if (!arg.startsWith('-')) paths.push(arg);
  }
  return { paths, label, timeoutMs };
}

function runSuitePaths(paths, options = {}) {
  const runtime = options.runtime || resolveTestRuntime(options.env || process.env);
  const spawn = options.spawn || spawnSync;
  const label = options.label ? ` (${options.label})` : '';

  if (!paths || paths.length === 0) {
    console.error('[suite] no paths provided');
    return 1;
  }

  if (runtime === 'node') {
    console.log(`[suite] runtime=node/jest${label}: ${paths.length} path(s)`);
    const args = [
      'jest',
      '--runInBand',
      '--coverage=false',
      ...(options.timeoutMs ? [`--testTimeout=${String(options.timeoutMs)}`] : []),
      ...paths
    ];
    const result = spawn('bunx', args, {
      stdio: 'inherit',
      env: { ...process.env, ...(options.env || {}), NODE_ENV: process.env.NODE_ENV || 'dev' }
    });
    return Number.isInteger(result.status) ? result.status : 1;
  }

  console.log(`[suite] runtime=bun${label}: ${paths.length} path(s)`);
  const result = spawn('bun', ['test', ...paths], {
    stdio: 'inherit',
    env: {
      ...process.env,
      ...(options.env || {}),
      NODE_ENV: process.env.NODE_ENV || 'dev'
    }
  });
  return Number.isInteger(result.status) ? result.status : 1;
}

if (require.main === module) {
  const parsed = parseArgs(process.argv);
  process.exitCode = runSuitePaths(parsed.paths, {
    label: parsed.label,
    timeoutMs: parsed.timeoutMs
  });
}

module.exports = { parseArgs, runSuitePaths };
