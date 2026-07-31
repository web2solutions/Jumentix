/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { readTestMap, isQuarantined } = require('./lib/test-map');
const { effectiveRunner, isCiNodeRuntime, resolveTestRuntime } = require('./lib/test-runtime');
const { runSuitePaths } = require('./run-suite');

const UNIT_DIR = 'apps/backend-template/test/unit';

function partitionUnitSuites(manifest, env = process.env) {
  const bunSuites = [];
  const nodeSuites = [];
  for (const suite of manifest.suites || []) {
    if (suite.type !== 'unit') continue;
    if (isQuarantined(manifest, suite.path) && isCiNodeRuntime(env)) {
      // Quarantined suites still execute report-only under CI node partition.
      nodeSuites.push(suite.path);
      continue;
    }
    if (effectiveRunner(suite, env) === 'node') nodeSuites.push(suite.path);
    else bunSuites.push(suite.path);
  }
  return { bunSuites, nodeSuites };
}

/**
 * `--isolate` gives each file a fresh global object, which is the isolation Jest
 * provides per file and `bun test` otherwise does not.
 *
 * Without it, a module replaced in one file stays replaced for every file that
 * runs after it. The composition-root suites mock twelve modules each —
 * PasswordCryptoService, MutexService, compileKeyValueStorageClient and the
 * rest — so their stubs were still installed when those modules' own suites ran,
 * and 19 tests failed in the shared run that passed when run alone. Nothing
 * pointed at the cause: the failures appeared in files that had not changed
 * (JUM-583).
 */
const BUN_ISOLATION = '--isolate';

/**
 * Coverage is deliberately NOT collected here.
 *
 * Bun's lcov contains no branch records at all — no `BRF`, no `BRH`, no `BRDA`.
 * Bun simply has no branch metric, and there is no flag that adds one. So a
 * Bun-produced report cannot satisfy Requirements 020/063, which mandate 90%
 * branch coverage, and writing one into `coverage/` would overwrite the report
 * that can.
 *
 * Coverage therefore comes from `bun run test:coverage`, which runs Jest for
 * that single purpose. Jest is no longer a test runner in this repository — it
 * is the coverage instrument, and `ci-cd/check-coverage-thresholds.js` reads its
 * lcov as the authority on all four metrics.
 */
function runBunUnit(suites, options = {}) {
  const spawn = options.spawn || spawnSync;
  const args = suites.length > 0
    ? ['test', BUN_ISOLATION, ...suites]
    : ['test', BUN_ISOLATION, UNIT_DIR];
  console.log(`[ci] unit tests (bun:test, isolated): ${suites.length || 'directory'} target(s)`);
  const result = spawn('bun', args, {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'dev' }
  });
  return Number.isInteger(result.status) ? result.status : 1;
}

function runNodeUnit(suites, options = {}) {
  if (suites.length === 0) return 0;
  console.log(`[ci] unit tests (node/jest CI-only partition): ${suites.length} target(s)`);
  return runSuitePaths(suites, {
    runtime: 'node',
    spawn: options.spawn,
    env: options.env
  });
}

function runUnitTests(options = {}) {
  const root = options.root || path.resolve(__dirname, '..');
  process.chdir(root);
  const env = options.env || process.env;
  const runtime = resolveTestRuntime(env);

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

  // Req 106: local always Bun for all unit suites.
  if (runtime === 'bun') {
    const all = (manifest.suites || [])
      .filter((suite) => suite.type === 'unit' && !isQuarantined(manifest, suite.path))
      .map((suite) => suite.path);
    return runBunUnit(all, options);
  }

  const { bunSuites, nodeSuites } = partitionUnitSuites(manifest, env);
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
