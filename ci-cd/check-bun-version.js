/**
 * Bun toolchain guard.
 *
 * Mirrors `ci-cd/check-node-version.js`, which guarded the Node runtime this
 * replaces. Requirement 096 §1 makes a *pinned* Bun toolchain the root of the
 * migration: nothing else in the epic is reproducible if the local and CI
 * runtimes disagree, and a version skew shows up as an unrelated test failure
 * three steps later rather than as a toolchain error here.
 *
 * The guard fails closed. It asserts, in order:
 *
 *   1. the process is actually running under Bun (not Node with Bun installed);
 *   2. `.bun-version` exists and holds a single exact version;
 *   3. `package.json#packageManager` names bun at that same version, so there
 *      is one source of truth rather than two that can drift;
 *   4. the running Bun matches the pin exactly.
 *
 * Exact, not a range: a range is how "works on my machine" gets committed.
 */

// Dependency-free on purpose: this runs as the `preinstall` hook, before
// node_modules exists on a cold clone. Requiring `semver` here would make the
// guard fail for a reason unrelated to the toolchain.
const fs = require('fs');
const path = require('path');

const EXACT_VERSION = /^\d+\.\d+\.\d+$/;

const repoRoot = path.resolve(__dirname, '..');
const pinFile = path.join(repoRoot, '.bun-version');
const packageJsonPath = path.join(repoRoot, 'package.json');

const failures = [];

function fail(message) {
  failures.push(message);
}

// 1. Running under Bun at all.
const runningBunVersion = process.versions && process.versions.bun;
if (!runningBunVersion) {
  fail(
    'Not running under Bun. Internal engineering workflows must execute on the '
      + 'pinned Bun toolchain (Requirement 096 §1). Invoke this guard with '
      + '`bun ci-cd/check-bun-version.js`.',
  );
}

// 2. The pin file.
let pinnedVersion = null;
if (!fs.existsSync(pinFile)) {
  fail('.bun-version is missing. The canonical Bun version must be pinned in the repository.');
} else {
  const rawPin = fs.readFileSync(pinFile, 'utf8').trim();
  if (!rawPin) {
    fail('.bun-version is empty.');
  } else if (!EXACT_VERSION.test(rawPin)) {
    fail(
      `.bun-version must contain a single exact version, found "${rawPin}". `
        + 'Ranges are not accepted: a range lets local and CI diverge.',
    );
  } else {
    pinnedVersion = rawPin;
  }
}

// 3. packageManager agrees with the pin.
let declaredPackageManager = null;
if (!fs.existsSync(packageJsonPath)) {
  fail('package.json is missing.');
} else {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  declaredPackageManager = pkg.packageManager || null;

  if (!declaredPackageManager) {
    fail('package.json#packageManager is not set. It must declare bun at the pinned version.');
  } else {
    const match = /^bun@(.+)$/.exec(declaredPackageManager);
    if (!match) {
      fail(
        `package.json#packageManager is "${declaredPackageManager}", expected "bun@<version>". `
          + 'Requirement 096 §1 makes Bun the sole internal package manager.',
      );
    } else if (pinnedVersion && match[1] !== pinnedVersion) {
      fail(
        `Version skew between sources of truth: .bun-version is "${pinnedVersion}" but `
          + `package.json#packageManager is "${declaredPackageManager}". They must match exactly.`,
      );
    }
  }
}

// 4. The running Bun matches the pin.
if (runningBunVersion && pinnedVersion && runningBunVersion !== pinnedVersion) {
  fail(
    `Bun version mismatch: running ${runningBunVersion}, pinned ${pinnedVersion}. `
      + `Install the pinned version (\`bun upgrade --to ${pinnedVersion}\`) or update the pin `
      + 'deliberately, with the matrix re-run that justifies it.',
  );
}

if (failures.length > 0) {
  console.error('Bun toolchain guard failed:\n');
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  console.error('');
  process.exit(1);
}

console.log(`Bun toolchain guard passed: running pinned Bun ${pinnedVersion}.`);
