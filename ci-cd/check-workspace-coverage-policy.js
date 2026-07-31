/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const MINIMUM_GLOBAL_THRESHOLDS = {
  statements: 99,
  lines: 99,
  functions: 99,
  branches: 90
};

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
    if (!Number.isFinite(current) || current < minimum) {
      failures.push(
        `Root coverageThreshold.global.${metric} must be >= ${minimum} (current: ${
          Number.isFinite(current) ? current : 'missing'
        })`
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

if (require.main === module) {
  run();
}

module.exports = {
  MINIMUM_GLOBAL_THRESHOLDS,
  validateGlobalCoverageThreshold,
  validatePackageCoveragePolicy
};
