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
const path = require('path');
const { spawnSync } = require('child_process');
const { resolveTestRuntime } = require('./lib/test-runtime');
const { readTestMap } = require('./lib/test-map');
const { isEntryPoint } = require('./lib/entry-point.js');

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

/**
 * Reject a suite path that is not one.
 *
 * These arrive from `process.argv` and are handed to a spawned process. The
 * spawn uses an argument array rather than a shell, so there is nothing to
 * escape from today — but "no shell" is a property of this file, not of its
 * callers, and a path that leaves the repository is wrong long before it is
 * dangerous: it would run someone else's tests and report them as this suite's.
 *
 * Relative, inside the repository, no shell metacharacters.
 */
function invalidSuitePaths(paths, root = process.cwd()) {
  const base = `${path.resolve(root)}${path.sep}`;

  return paths.filter((given) => {
    if (typeof given !== 'string' || given.length === 0) return true;
    if (/[;&|`$()<>\n]/.test(given)) return true;
    if (path.isAbsolute(given)) return true;
    return !path.resolve(root, given).startsWith(base);
  });
}

/**
 * Rebuild each accepted path as a repository-relative one.
 *
 * The filter above decides *whether* a path is acceptable; this decides what is
 * actually handed to the spawn. Passing the argv strings straight through works,
 * but it means the value that was validated and the value that is executed are
 * the same object — so any later edit that moves the check, or adds a path after
 * it, silently stops being covered.
 *
 * Deriving new strings makes the executed value depend on the validated one by
 * construction, and canonicalises `./a/../b` shapes on the way through.
 */
function canonicalSuitePaths(paths, root = process.cwd()) {
  return paths.map((given) => path.relative(root, path.resolve(root, given)));
}

function runSuitePaths(paths, options = {}) {
  const spawn = options.spawn || spawnSync;
  const label = options.label ? ` (${options.label})` : '';

  if (!paths || paths.length === 0) {
    console.error('[suite] no paths provided');
    return 1;
  }

  const rejected = invalidSuitePaths(paths);
  if (rejected.length > 0) {
    console.error(`[suite] refusing paths outside the repository: ${rejected.join(', ')}`);
    return 1;
  }

  const safePaths = canonicalSuitePaths(paths);

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
      ...safePaths
    ];
    const result = spawn('bunx', args, {
      stdio: 'inherit',
      env: { ...process.env, ...(options.env || {}), NODE_ENV: process.env.NODE_ENV || 'dev' }
    });
    return Number.isInteger(result.status) ? result.status : 1;
  }

  console.log(`[suite] runtime=bun${label}: ${paths.length} path(s)`);
  const result = spawn(process.execPath, ['test', ...safePaths], {
    stdio: 'inherit',
    env: {
      ...process.env,
      ...(options.env || {}),
      NODE_ENV: process.env.NODE_ENV || 'dev'
    }
  });
  return Number.isInteger(result.status) ? result.status : 1;
}

if (isEntryPoint(module)) {
  const parsed = parseArgs(process.argv);
  process.exitCode = runSuitePaths(parsed.paths, {
    label: parsed.label,
    timeoutMs: parsed.timeoutMs
  });
}

module.exports = {
  canonicalSuitePaths,
  invalidSuitePaths,
  mapPinsToNode,
  parseArgs,
  runSuitePaths
};
