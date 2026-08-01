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
const fs = require('node:fs');
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

/**
 * Turn the requested paths into suite paths read from the test map.
 *
 * The arguments arrive from `process.argv` and end up as arguments to a spawned
 * process. Validating them is not the same as untainting them: the string that
 * was checked is still the string that executes, so every future edit has to
 * keep the check and the use in step. Here the executed values are the manifest's
 * own entries — the request only *selects* among them — so an argument cannot
 * name something the map does not already list. Sonar reports the previous shape
 * as `jssecurity:S8705`; this removes the flow rather than annotating it.
 *
 * It also makes a mistyped path fail loudly. Before, `.../integration/Expres`
 * matched nothing and the runner reported success over zero suites.
 *
 * Every test file under a requested directory must be mapped. Expanding only
 * what the map happens to list would let an unmapped suite sit in a directory
 * that reports as fully run — the false green Requirement 065 exists to prevent.
 */
function resolveMappedSuitePaths(paths, options = {}) {
  const root = options.root || process.cwd();
  const readMap = options.readTestMap || readTestMap;
  const listFiles = options.listTestFiles || defaultListTestFiles;

  const manifest = readMap();
  const mapped = (manifest.suites || []).map((suite) => suite.path);
  const mappedSet = new Set(mapped);

  const resolved = [];
  const unmatched = [];
  const unmapped = [];

  for (const request of canonicalSuitePaths(paths, root)) {
    // Elements of `mapped`, never the request itself.
    const matches = mapped.filter(
      (suite) => suite === request || suite.startsWith(`${request}/`)
    );

    if (matches.length === 0) {
      unmatched.push(request);
      continue;
    }

    for (const onDisk of listFiles(path.resolve(root, request), root)) {
      if (!mappedSet.has(onDisk)) unmapped.push(onDisk);
    }

    resolved.push(...matches);
  }

  return { resolved: [...new Set(resolved)], unmatched, unmapped };
}

/** Every `*.test.ts` at or below `target`, as repository-relative paths. */
function defaultListTestFiles(target, root) {
  if (!fs.existsSync(target)) return [];

  const stats = fs.statSync(target);
  if (stats.isFile()) {
    return target.endsWith('.test.ts') ? [path.relative(root, target)] : [];
  }

  return fs.readdirSync(target, { withFileTypes: true })
    .flatMap((entry) => defaultListTestFiles(path.join(target, entry.name), root));
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

  // The paths that actually execute come from the test map, not from argv.
  const { resolved, unmatched, unmapped } = (options.resolveMappedSuitePaths
    || resolveMappedSuitePaths)(paths, options);

  if (unmatched.length > 0) {
    console.error(
      `[suite] no mapped suite matches: ${unmatched.join(', ')}\n`
        + '  Suite paths are resolved through test-map.json. A path that matches nothing\n'
        + '  would otherwise run zero tests and report success. Check the spelling, or\n'
        + '  register the suite with `bun run test-map:generate`.'
    );
    return 1;
  }

  if (unmapped.length > 0) {
    console.error(
      `[suite] test files present on disk but absent from test-map.json:\n`
        + unmapped.map((file) => `    ${file}`).join('\n')
        + '\n  Running the requested path would skip them while reporting the whole\n'
        + '  directory as covered. Register them with `bun run test-map:generate`.'
    );
    return 1;
  }

  const safePaths = resolved;

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
      // No shell, stated rather than relied on: an argument array is only safe
      // from interpolation while nobody adds `shell: true` to "make quoting work".
      shell: false,
      stdio: 'inherit',
      env: { ...process.env, ...(options.env || {}), NODE_ENV: process.env.NODE_ENV || 'dev' }
    });
    return Number.isInteger(result.status) ? result.status : 1;
  }

  console.log(`[suite] runtime=bun${label}: ${paths.length} path(s)`);
  // `--isolate`, matching `run-unit-tests.js`. Bun shares one process across
  // files unless told otherwise, so module state — an in-memory store, a
  // registered singleton — survives from one suite into the next. Jest gives
  // each file a fresh module registry, so without this the two runners disagree
  // about what the same suites do.
  //
  // The failure mode is not a visible error. Running the three Lambda suites
  // together reported "13 pass, 1 fail" across 14 tests; with isolation the same
  // directory reports 25 pass across 25. Eleven tests never ran at all — a
  // seeded user collided with one left behind by the previous file, the failure
  // aborted the rest of that suite, and the run still looked almost healthy.
  const result = spawn(process.execPath, ['test', '--isolate', ...safePaths], {
    shell: false,
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
  defaultListTestFiles,
  invalidSuitePaths,
  mapPinsToNode,
  parseArgs,
  resolveMappedSuitePaths,
  runSuitePaths
};
