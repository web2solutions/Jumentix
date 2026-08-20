/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const MINIMUM_GLOBAL_THRESHOLDS = {
  // JUM-681: 98 across the board, set by the requirement owner. The exception
  // register below — which this reads rather than copies — is where the measured
  // branch gap lives, as a floor that can only be held or improved.
  statements: 98,
  lines: 98,
  functions: 98,
  branches: 98
};

/**
 * Exceptions come from the coverage checker, not from a second copy here.
 *
 * Two guards enforcing the same numbers is fine; two guards holding their own
 * idea of which concessions are live is not — one would keep passing a metric
 * the other had already released, or keep failing one the owner had accepted.
 * `ci-cd/check-coverage-thresholds.js` owns the exception register
 * (Requirement 110); this reads it.
 */
// eslint-disable-next-line import/no-dynamic-require, global-require
const { ACCEPTED_BELOW_THRESHOLD } = require('./check-coverage-thresholds');
const { isEntryPoint } = require('./lib/entry-point.js');

const TEST_PLACEHOLDER_PATTERN = /echo\s+["'][^"']*(no tests yet|placeholder|pending)[^"']*["']/i;
const PACKAGE_TEST_PLACEHOLDER_ALLOWLIST = new Set([
  // Req 106 / JUM-557: placeholders are forbidden. Packages without unit tests
  // declare jumentix.testSurface=typecheck-only and run typecheck via `test`.
]);

function readRootJestConfig(rootDir) {
  const jestPath = path.join(rootDir, 'jest.config.js');
  if (!fs.existsSync(jestPath)) return null;
  // eslint-disable-next-line import/no-dynamic-require, global-require
  return require(jestPath);
}

function collectWorkspacePackageJson(rootDir) {
  const packageRoots = ['packages', 'apps'];
  const files = [];
  for (const baseDir of packageRoots) {
    const absBase = path.join(rootDir, baseDir);
    if (!fs.existsSync(absBase)) continue;
    for (const dirName of fs.readdirSync(absBase)) {
      const pkgPath = path.join(absBase, dirName, 'package.json');
      if (fs.existsSync(pkgPath)) {
        files.push(pkgPath);
      }
    }
  }
  return files;
}

function validateGlobalCoverageThreshold(jestConfig) {
  const failures = [];
  const globalThreshold = jestConfig?.coverageThreshold?.global || {};
  for (const [metric, minimum] of Object.entries(MINIMUM_GLOBAL_THRESHOLDS)) {
    const current = Number(globalThreshold?.[metric]);
    const exception = ACCEPTED_BELOW_THRESHOLD[metric];
    // A metric under a dated, tracked exception may sit at its floor. The
    // coverage checker is what stops it going lower or lingering once resolved.
    const floor = exception ? exception.floor : minimum;

    if (!Number.isFinite(current) || current < floor) {
      failures.push(
        `Root coverageThreshold.global.${metric} must be >= ${floor}${
          exception ? ` (${minimum} relaxed to the accepted floor under ${exception.issue})` : ''
        } (current: ${Number.isFinite(current) ? current : 'missing'})`
      );
    }
  }
  return failures;
}

function validatePackageCoveragePolicy(pkg) {
  const failures = [];
  const scripts = pkg.scripts || {};
  const testScript = String(scripts.test || '').trim();

  if (testScript.length === 0) {
    failures.push(`[${pkg.name}] missing test script`);
    return failures;
  }

  const allowlisted = PACKAGE_TEST_PLACEHOLDER_ALLOWLIST.has(pkg.name);
  if (!allowlisted && TEST_PLACEHOLDER_PATTERN.test(testScript)) {
    failures.push(`[${pkg.name}] test script must not be placeholder output`);
  }
  return failures;
}

function run() {
  const rootDir = process.cwd();
  const failures = [];

  const jestConfig = readRootJestConfig(rootDir);
  if (!jestConfig) {
    failures.push('Root jest.config.js not found');
  } else {
    failures.push(...validateGlobalCoverageThreshold(jestConfig));
  }

  const packageJsonFiles = collectWorkspacePackageJson(rootDir);
  for (const pkgFile of packageJsonFiles) {
    const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
    failures.push(...validatePackageCoveragePolicy(pkg));
  }

  if (failures.length > 0) {
    console.error('Workspace coverage policy violations found:');
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
  }

  console.log('Workspace coverage policy check passed.');
}

if (isEntryPoint(module)) {
  run();
}

module.exports = {
  MINIMUM_GLOBAL_THRESHOLDS,
  validateGlobalCoverageThreshold,
  validatePackageCoveragePolicy
};
