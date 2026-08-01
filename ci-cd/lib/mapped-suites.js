/**
 * Which test files exist on disk, and which of them the manifest knows about.
 *
 * `test-map.json` is not a description of the suites — it is the input that
 * decides which ones run. `ci-cd/run-unit-tests.js` builds its target list from
 * it, so a file present on disk and absent from the map is not "unlisted": it
 * never executes, and nothing reports that. The suite passes by never running.
 *
 * That is why the enumeration lives here rather than in either caller.
 * `run-suite.js` already answered a narrower version of the question — is
 * anything under *these paths* unmapped — and the global question is the same
 * comparison over the whole tree. Two implementations of it would drift, and the
 * one that drifted would go on reporting success.
 */

const fs = require('node:fs');
const path = require('node:path');

/** Directories that never hold suites, skipped before descending. */
const SKIP = Object.freeze(['node_modules', 'dist', '.build', 'coverage', '.git']);

const TEST_FILE = /\.test\.ts$/;

/**
 * Order two repository paths, deterministically.
 *
 * Explicitly, because a bare `.sort()` is type-dependent and Sonar is right to
 * flag it (`javascript:S2871`) — but *not* the `localeCompare` the rule
 * suggests. Locale-aware collation is the opposite of what these lists need: it
 * orders differently under different ICU locales, so the same tree would produce
 * a different unmapped-suite report on two machines and the diff would read as a
 * change nobody made. Code-unit order is the same everywhere.
 */
function byPath(left, right) {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

/**
 * Every `*.test.ts` at or below `target`, as repository-relative paths.
 *
 * Accepts a file as readily as a directory: `run-suite.js` is handed both, and a
 * caller that had to know which it held would end up asking the filesystem twice.
 */
function listTestFiles(target, root) {
  if (!fs.existsSync(target)) return [];

  if (fs.statSync(target).isFile()) {
    return TEST_FILE.test(target) ? [relative(target, root)] : [];
  }

  return fs.readdirSync(target, { withFileTypes: true })
    .filter((entry) => !SKIP.includes(entry.name))
    .flatMap((entry) => listTestFiles(path.join(target, entry.name), root))
    .sort(byPath);
}

function relative(target, root) {
  return path.relative(root, target).replace(/\\/g, '/');
}

/**
 * Where suites are allowed to live.
 *
 * A list rather than a walk of the whole repository: `node_modules` alone holds
 * thousands of `*.test.ts` files belonging to dependencies, and reporting those
 * as unmapped would make the check unusable on its first run.
 */
function suiteRoots(root) {
  const packagesDir = path.join(root, 'packages');
  if (!fs.existsSync(packagesDir)) return ['apps'];

  // Sorted: `readdirSync` order is filesystem-dependent, and an unmapped-suite
  // report that changes order between machines reads like a different failure.
  const packageRoots = fs.readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join('packages', entry.name, 'test'))
    .sort(byPath);

  return ['apps', ...packageRoots];
}

/** Every suite file in the repository, whether or not the manifest lists it. */
function allTestFilesOnDisk(root, roots = suiteRoots(root)) {
  return [...new Set(
    roots.flatMap((suiteRoot) => listTestFiles(path.join(root, suiteRoot), root))
  )].sort(byPath);
}

/**
 * Suite files that exist but have no entry in the manifest.
 *
 * @param {{suites?: Array<{path?: string}>}} manifest
 * @returns {string[]} repository-relative paths, sorted.
 */
function unmappedTestFiles(manifest, root, roots) {
  const mapped = new Set((manifest?.suites || []).map((suite) => suite.path));
  return allTestFilesOnDisk(root, roots).filter((file) => !mapped.has(file));
}

module.exports = {
  SKIP,
  byPath,
  allTestFilesOnDisk,
  listTestFiles,
  suiteRoots,
  unmappedTestFiles
};
