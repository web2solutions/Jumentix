/**
 * Bun toolchain guard.
 *
 * Mirrors `ci-cd/check-node-version.js`, which guarded the Node runtime this
 * replaces. Requirement 096 §1 makes a *pinned* Bun toolchain the root of the
 * migration: nothing else in the epic is reproducible if the local and CI
 * runtimes disagree, and a version skew shows up as an unrelated test failure
 * three steps later rather than as a toolchain error here.
 *
 * The guard fails closed and asserts, in order:
 *
 *   1. the process is actually running under Bun (not Node with Bun installed);
 *   2. `.bun-version` exists and holds a single exact version;
 *   3. `package.json#packageManager` names bun at that same version, so there
 *      is one source of truth rather than two that can drift;
 *   4. the running Bun matches the pin exactly.
 *
 * Exact, not a range: a range is how "works on my machine" gets committed.
 *
 * Dependency-free on purpose: this runs as the `preinstall` hook, before
 * node_modules exists on a cold clone. Requiring `semver` here would make the
 * guard fail for a reason unrelated to the toolchain.
 *
 * Structured as pure validation plus a thin CLI, matching the other ci-cd
 * guards, so the logic is unit-testable without spawning a process.
 */

const fs = require('fs');
const path = require('path');

const EXACT_VERSION = /^\d+\.\d+\.\d+$/;

const repoRoot = path.resolve(__dirname, '..');
const pinFile = path.join(repoRoot, '.bun-version');
const packageJsonPath = path.join(repoRoot, 'package.json');

/**
 * Pure validation over already-read inputs.
 *
 * @param {object} input
 * @param {string|null} input.runningBunVersion `process.versions.bun`, or null under Node
 * @param {string|null} input.rawPin raw `.bun-version` contents, or null when absent
 * @param {string|null} input.declaredPackageManager `package.json#packageManager`, or null
 * @returns {string[]} human-readable failures; empty means the toolchain is sound
 */
function validateToolchain({ runningBunVersion, rawPin, declaredPackageManager }) {
  const failures = [];

  if (!runningBunVersion) {
    failures.push(
      'Not running under Bun. Internal engineering workflows must execute on the '
        + 'pinned Bun toolchain (Requirement 096 §1). Invoke this guard with '
        + '`bun ci-cd/check-bun-version.js`.',
    );
  }

  let pinnedVersion = null;
  if (rawPin === null || rawPin === undefined) {
    failures.push('.bun-version is missing. The canonical Bun version must be pinned in the repository.');
  } else {
    const trimmed = String(rawPin).trim();
    if (!trimmed) {
      failures.push('.bun-version is empty.');
    } else if (!EXACT_VERSION.test(trimmed)) {
      failures.push(
        `.bun-version must contain a single exact version, found "${trimmed}". `
          + 'Ranges are not accepted: a range lets local and CI diverge.',
      );
    } else {
      pinnedVersion = trimmed;
    }
  }

  if (!declaredPackageManager) {
    failures.push('package.json#packageManager is not set. It must declare bun at the pinned version.');
  } else {
    const match = /^bun@(.+)$/.exec(declaredPackageManager);
    if (!match) {
      failures.push(
        `package.json#packageManager is "${declaredPackageManager}", expected "bun@<version>". `
          + 'Requirement 096 §1 makes Bun the sole internal package manager.',
      );
    } else if (pinnedVersion && match[1] !== pinnedVersion) {
      failures.push(
        `Version skew between sources of truth: .bun-version is "${pinnedVersion}" but `
          + `package.json#packageManager is "${declaredPackageManager}". They must match exactly.`,
      );
    }
  }

  if (runningBunVersion && pinnedVersion && runningBunVersion !== pinnedVersion) {
    failures.push(
      `Bun version mismatch: running ${runningBunVersion}, pinned ${pinnedVersion}. `
        + `Install the pinned version (\`bun upgrade --to ${pinnedVersion}\`) or update the pin `
        + 'deliberately, with the matrix re-run that justifies it.',
    );
  }

  return failures;
}

/** Read the guard's inputs from disk and the current process. */
function readToolchainInput() {
  return {
    runningBunVersion: (process.versions && process.versions.bun) || null,
    rawPin: fs.existsSync(pinFile) ? fs.readFileSync(pinFile, 'utf8') : null,
    declaredPackageManager: fs.existsSync(packageJsonPath)
      ? JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')).packageManager || null
      : null,
  };
}

/**
 * @param input The toolchain facts to judge. Defaults to reading the real
 * environment; injected so the failure path can be exercised without depending
 * on which runtime the test itself happens to run under. The guard's entire
 * purpose is to fail when not on Bun, so a test that produced that state by
 * being executed under Node worked only under Node (JUM-583).
 */
function main(input = readToolchainInput()) {
  const failures = validateToolchain(input);

  if (failures.length > 0) {
    console.error('Bun toolchain guard failed:\n');
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    console.error('');
    process.exit(1);
  }

  console.log(`Bun toolchain guard passed: running pinned Bun ${String(input.rawPin).trim()}.`);
}

if (require.main === module) {
  main();
}

module.exports = {
  EXACT_VERSION,
  main,
  readToolchainInput,
  validateToolchain,
};
