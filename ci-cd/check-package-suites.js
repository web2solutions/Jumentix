#!/usr/bin/env bun
/* eslint-disable no-console */
/**
 * Requirement 112 — every package and app owns its own test suite.
 *
 * A library whose only coverage comes from an application's tests is not tested;
 * the application is. The distinction is invisible in an aggregate number and
 * decisive in practice: change the library, and the suite that would catch the
 * break belongs to someone else, runs on someone else's schedule, and passes for
 * reasons unrelated to the change. That is the coupling this check exists to end.
 *
 * It ratchets in both directions, which is the part that matters. A package with
 * no suite must be declared here, with a date and an issue. A declared package
 * that has since grown a suite **also fails** — the entry has done its job and
 * has to go, or the list quietly becomes a permanent exemption and the register
 * stops describing anything.
 *
 * The same list appears in `sonar-project.properties` as coverage exclusions.
 * Kept in step deliberately: an entry there without one here would hide a
 * package from Sonar while this check believed it was covered.
 */

const fs = require('node:fs');
const path = require('node:path');
const { runWhenEntryPoint } = require('./lib/entry-point.js');
const { byPath } = require('./lib/mapped-suites.js');
const { emitsNoJavaScript } = require('./lib/emits-javascript.js');

const PACKAGES_DIR = 'packages';
const SONAR_CONFIG = 'sonar-project.properties';

/**
 * Packages that do not yet own a suite.
 *
 * Every entry is temporary. `since` is when the debt was recorded, `issue` is
 * where the work is tracked, and `reason` says why it has not happened yet —
 * "no time" is a reason; the absence of one is not.
 */
const WITHOUT_SUITE_YET = Object.freeze({
  'external-store-proxy': { since: '2026-08-01', issue: 'JUM-585', reason: 'Proxy layer; needs a store double.' },
  'message-mediator': { since: '2026-08-01', issue: 'JUM-585', reason: 'Six source files; broker adapters need doubles.' },
});

/**
 * A package with no source of its own has nothing to test.
 *
 * `.js` counts, not only `.ts`. Checking TypeScript alone let a JavaScript
 * package escape this requirement entirely: `cli-init` ships `src/bootstrap.js`,
 * read here as sourceless, and its only coverage came from an application suite
 * three workspaces away — the exact arrangement Requirement 112 exists to end,
 * hidden by the check meant to find it.
 *
 * Source means source that runs. A file of nothing but `interface` and `type`
 * declarations compiles to an empty module: no test can execute a line of it,
 * and it can never appear in a coverage report. Demanding a suite for a package
 * made only of those asks for something that cannot exist, and the only way to
 * satisfy the demand would be a test asserting nothing — which is worse than no
 * test, because it reports green. `persistence-contracts` is exactly that
 * package: three files, every one of them types.
 *
 * The compiler is asked rather than the filename, so a package that mixes one
 * constant in with its types still owes a suite, and a package that later grows
 * a runtime file starts owing one the moment it does.
 */
function hasSource(packageDir) {
  const src = path.join(packageDir, 'src');
  if (!fs.existsSync(src)) return false;
  return listFiles(src).some((file) => {
    if (!file.endsWith('.ts') && !file.endsWith('.js')) return false;
    if (file.endsWith('.d.ts')) return false;
    return !emitsNoJavaScript(file);
  });
}

function hasSuite(packageDir) {
  return listFiles(packageDir).some((file) => /\.(test|spec)\.ts$/.test(file));
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (['node_modules', 'dist', '.build', 'coverage'].includes(entry.name)) return [];
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : [full];
  });
}

function readSonarExclusions(root, readFile) {
  const contents = readFile(path.join(root, SONAR_CONFIG));
  // Continuation lines end with a backslash; join before splitting on commas.
  const joined = contents.replace(/\\\s*\n\s*/g, '');
  const line = joined.split('\n').find((entry) => entry.startsWith('sonar.coverage.exclusions='));
  if (!line) return new Set();

  return new Set(
    line.slice('sonar.coverage.exclusions='.length)
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  );
}

function run(options = {}) {
  const root = options.root || process.cwd();
  const register = options.register || WITHOUT_SUITE_YET;
  const readFile = options.readFile || ((file) => fs.readFileSync(file, 'utf8'));
  const listPackages = options.listPackages || (() => fs.readdirSync(path.join(root, PACKAGES_DIR)));

  const failures = [];
  let sonarExclusions;
  try {
    sonarExclusions = readSonarExclusions(root, readFile);
  } catch (error) {
    return { ok: false, message: `Cannot read ${SONAR_CONFIG}: ${error.message}` };
  }

  for (const name of listPackages().sort(byPath)) {
    const dir = path.join(root, PACKAGES_DIR, name);
    if (!options.listPackages && !fs.statSync(dir).isDirectory()) continue;
    if (!hasSource(dir)) continue;

    const declared = Object.prototype.hasOwnProperty.call(register, name);
    const suite = hasSuite(dir);

    if (!suite && !declared) {
      failures.push(
        `${name} has source but no test suite of its own, and is not declared.\n`
          + '    Requirement 112: a library covered only by an application\'s tests is not\n'
          + '    tested — the application is. Add a suite under packages/' + name + '/test/,\n'
          + '    or record the debt in WITHOUT_SUITE_YET with a since date and an issue.'
      );
      continue;
    }

    // The ratchet. Without this the register is write-only and never shrinks.
    if (suite && declared) {
      failures.push(
        `${name} now has a suite but is still declared in WITHOUT_SUITE_YET.\n`
          + `    Remove the entry, and remove packages/${name}/** from\n`
          + `    sonar.coverage.exclusions so its own coverage starts counting.`
      );
      continue;
    }

    if (!suite && declared) {
      const entry = register[name];
      if (!entry.since || !/^\d{4}-\d{2}-\d{2}$/.test(entry.since)) {
        failures.push(`${name} is declared without a valid ISO \`since\` date.`);
      }
      if (!entry.issue) failures.push(`${name} is declared without a tracking \`issue\`.`);
      if (!entry.reason) failures.push(`${name} is declared without a \`reason\`.`);

      // Sonar must not be told a declared package is covered.
      if (!sonarExclusions.has(`packages/${name}/**`)) {
        failures.push(
          `${name} has no suite but is not in sonar.coverage.exclusions.\n`
            + '    Sonar would report it 0% covered on new code and fail the quality gate\n'
            + '    for a gap already recorded here.'
        );
      }
    }
  }

  // An exclusion for a package that is not declared is the same stale exemption
  // seen from the other side.
  for (const excluded of sonarExclusions) {
    const match = /^packages\/([^/]+)\/\*\*$/.exec(excluded);
    if (!match) continue;
    const name = match[1];
    const dir = path.join(root, PACKAGES_DIR, name);
    if (!fs.existsSync(dir)) continue;
    if (!hasSource(dir)) continue;
    if (!Object.prototype.hasOwnProperty.call(register, name)) {
      failures.push(
        `packages/${name}/** is excluded from Sonar coverage but is not declared in\n`
          + '    WITHOUT_SUITE_YET. Either it has a suite — in which case the exclusion\n'
          + '    hides it — or the debt is unrecorded.'
      );
    }
  }

  if (failures.length > 0) {
    return {
      ok: false,
      message: `Package suite check failed (Requirement 112):\n\n${failures.map((f) => `  - ${f}`).join('\n\n')}`
    };
  }

  const outstanding = Object.keys(register).length;
  return {
    ok: true,
    message: outstanding === 0
      ? 'Package suite check passed: every package with source owns a suite.'
      : `Package suite check passed: ${outstanding} package(s) still owe a suite, each declared with a date and an issue.`
  };
}

function main(io = console, execute = run) {
  const result = execute();
  if (result.ok) {
    io.log(result.message);
    return 0;
  }
  io.error(result.message);
  return 1;
}

// `runMain` rather than the helper's `execute`: the option name is this
// module's published contract and its suite injects through it.
const runAsEntryPoint = ({ runMain = main, ...rest } = {}) => runWhenEntryPoint({
  caller: module,
  execute: runMain,
  ...rest
});

runAsEntryPoint();

module.exports = {
  WITHOUT_SUITE_YET,
  main,
  readSonarExclusions,
  run,
  runAsEntryPoint
};
