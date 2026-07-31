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
const { readTestMap } = require('./lib/test-map');

/**
 * Whether the map pins these paths to Node.
 *
 * The map is where a suite's runner is declared, so it has to be able to force
 * one. Without this the declaration was advisory: `test:integration:restify`
 * resolved its runtime from the environment alone and would run under Bun
 * locally, where restify cannot even load — it pulls spdy -> handle-thing ->
 * `process.binding('stream_wrap')`, which Bun does not implement
 * (oven-sh/bun#4957).
 *
 * Only `runner: "node"` with a `reason` counts, which is the same declared
 * exception `check-test-map` enforces (Requirement 110). A single pinned suite
 * in the set is enough: the alternative is running the rest under Bun and that
 * one nowhere.
 */
function mapPinsToNode(paths) {
  let manifest;
  try {
    manifest = readTestMap();
  } catch {
    // No map, no pin. The caller's own runtime resolution stands.
    return false;
  }

  return (manifest.suites || []).some(
    (suite) => suite.runner === 'node'
      && Boolean(suite.reason)
      && paths.some((given) => suite.path === given || suite.path.startsWith(`${given}/`))
  );
}

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
  const spawn = options.spawn || spawnSync;
  const label = options.label ? ` (${options.label})` : '';

  if (!paths || paths.length === 0) {
    console.error('[suite] no paths provided');
    return 1;
  }

  // A map pin wins over environment resolution: it exists because the suite
  // cannot run under Bun at all, so "prefer bun locally" is not a choice here.
  const pinned = (options.mapPinsToNode || mapPinsToNode)(paths);
  const runtime = options.runtime
    || (pinned ? 'node' : resolveTestRuntime(options.env || process.env));

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

module.exports = {
  mapPinsToNode,
  parseArgs,
  runSuitePaths
};
