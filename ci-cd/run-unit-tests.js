/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { readTestMap, isQuarantined } = require('./lib/test-map');
const { effectiveRunner, isCiNodeRuntime, resolveTestRuntime } = require('./lib/test-runtime');
const { runSuitePaths } = require('./run-suite');
const { isEntryPoint } = require('./lib/entry-point.js');

const UNIT_DIR = 'apps/backend-template/test/unit';

/**
 * Split the unit suites into what gates and what only reports.
 *
 * A quarantined suite still runs under the CI Node partition, because a suite
 * nobody can see is a suite nobody fixes — but it comes back in its own list,
 * since "report-only" has to be something the code does and not only something
 * a comment claims.
 *
 * It claimed it and did not do it. Quarantined paths went into `nodeSuites`,
 * whose status is the return value, so a quarantined suite failed the build
 * exactly as a gating one would: visibility bought, no relief granted, which is
 * the reverse of the trade a quarantine exists to make. It surfaced as cana's
 * wall-clock performance suite failing a pull request it had been deliberately
 * removed from the gate for.
 */
function partitionUnitSuites(manifest, env = process.env) {
  const bunSuites = [];
  const nodeSuites = [];
  const reportOnlySuites = [];

  for (const suite of manifest.suites || []) {
    if (suite.type !== 'unit') continue;
    if (isQuarantined(manifest, suite.path)) {
      if (isCiNodeRuntime(env)) reportOnlySuites.push(suite.path);
      continue;
    }
    if (effectiveRunner(suite, env) === 'node') nodeSuites.push(suite.path);
    else bunSuites.push(suite.path);
  }

  return { bunSuites, nodeSuites, reportOnlySuites };
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

/**
 * Run the quarantined suites and report, without gating.
 *
 * Separate invocation on purpose. Folding them into the gating run means the
 * one exit status carries both verdicts, and there is then no way to say "this
 * failed and it does not block" — which is the entire content of a quarantine.
 *
 * The outcome is announced either way. A quarantined suite that has started
 * passing is the signal that the entry can go, and it is worth as much as the
 * failure that put it there.
 */
function runReportOnlyUnit(suites, options = {}) {
  if (suites.length === 0) return 0;

  console.log(`[ci] quarantined suites (report-only, not gating): ${suites.length} target(s)`);
  const status = runSuitePaths(suites, {
    runtime: 'node',
    spawn: options.spawn,
    env: options.env
  });

  console.log(
    status === 0
      ? '[ci] quarantined suites passed — check whether the quarantine entry can be removed.'
      : `[ci] quarantined suites failed (exit ${String(status)}); not gating, see test-map.json.`
  );

  return status;
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

  // The three runners are injectable because the composition is the thing that
  // regressed: each behaved correctly on its own, and the quarantine leaked into
  // the gate through how they were wired together.
  const runBun = options.runBunUnit || runBunUnit;
  const runNode = options.runNodeUnit || runNodeUnit;
  const runReportOnly = options.runReportOnlyUnit || runReportOnlyUnit;

  const { bunSuites, nodeSuites, reportOnlySuites } = partitionUnitSuites(manifest, env);
  const bunStatus = runBun(bunSuites, options);
  if (bunStatus !== 0) return bunStatus;

  const nodeStatus = runNode(nodeSuites, options);

  // Deliberately after the status that gates, and deliberately discarded: this
  // is the line that makes the quarantine mean something.
  runReportOnly(reportOnlySuites, options);

  return nodeStatus;
}

if (isEntryPoint(module)) {
  process.exitCode = runUnitTests();
}

module.exports = {
  partitionUnitSuites,
  runBunUnit,
  runNodeUnit,
  runReportOnlyUnit,
  runUnitTests
};
