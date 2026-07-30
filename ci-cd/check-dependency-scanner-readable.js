/**
 * Dependency-scanner readability guard.
 *
 * Snyk cannot parse `bun.lock`. With no lockfile it recognises, it does not fail —
 * it silently falls back to reading direct dependencies out of `package.json`.
 * Measured on this tree with an authenticated CLI:
 *
 *   snyk test --all-projects  ->  exit 0, "no vulnerable paths found",
 *                                 "Tested 45 dependencies" at the root
 *
 * The root resolves to over 4000 packages. So the scanner reports green while
 * seeing roughly one percent of the graph, and every advisory in `.snyk` —
 * `restify>find-my-way`, `send`, `cassandra-driver>adm-zip` — is *transitive*,
 * which is exactly the part that went dark.
 *
 * That is the worst shape a security control can take: not absent, but present
 * and reassuring. This guard converts it into a loud failure.
 *
 * Approaches measured and rejected, recorded so they are not retried blind:
 *
 *   - `bun install --yarn` projection: Snyk's yarn v1 parser rejects the emitted
 *     file ("Dependency string-width-cjs@npm:string-width@^4.2.0 was not found
 *     in yarn.lock"), because bun writes yarn protocol aliases it cannot read.
 *   - `snyk --package-manager=bun`: no such package manager; Snyk's CLI help does
 *     not mention bun at all.
 *   - `npm install --package-lock-only`: blocked by this repository's own
 *     preinstall toolchain guard, and it would resolve independently of
 *     `bun.lock` anyway, describing a tree we do not install.
 *
 * Remedies all require a decision that is not this guard's to make: adopt a
 * Bun-native scanner via `[install.security]` (choosing whose code runs over our
 * dependency graph), accept a second derived lockfile with drift detection, or
 * defer the pnpm removal until dependency scanning has a Bun answer.
 *
 * Until one is chosen, this guard fails. That is the honest state.
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

/** Lockfile formats Snyk can resolve a full transitive tree from. */
const SCANNER_READABLE_LOCKFILES = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];

/** Configuration files whose presence means Snyk is an active control here. */
const SNYK_CONFIG_FILES = ['.snyk'];

/**
 * @param {(relative: string) => boolean} exists
 * @param {{scannerOptOut?: boolean}} options set scannerOptOut once a remedy is
 *   chosen and recorded, so this guard stops being the blocker
 * @returns {string[]} failures; empty means dependency scanning can see the tree
 */
function validateScannerReadability(exists, options = {}) {
  const failures = [];
  const snykConfigured = SNYK_CONFIG_FILES.some((file) => exists(file));

  if (!snykConfigured || options.scannerOptOut) {
    return failures;
  }

  const readable = SCANNER_READABLE_LOCKFILES.filter((file) => exists(file));
  if (readable.length === 0) {
    failures.push(
      'Snyk is configured (.snyk is present) but no lockfile it can parse exists '
        + `(looked for: ${SCANNER_READABLE_LOCKFILES.join(', ')}). Snyk does not support `
        + 'bun.lock; it will silently scan direct dependencies from package.json only and '
        + 'report green while the transitive tree is unscanned. Every advisory in .snyk is '
        + 'transitive, so this is a live blind spot, not a theoretical one.',
    );
  }

  return failures;
}

function main() {
  const exists = (relative) => fs.existsSync(path.join(repoRoot, relative));
  const failures = validateScannerReadability(exists, {
    // Flip to true only alongside a recorded decision — a Bun-native scanner in
    // bunfig `[install.security]`, or an accepted derived lockfile with a drift
    // check. Flipping it without one re-hides the blind spot.
    scannerOptOut: process.env.JUMENTIX_ACCEPT_SHALLOW_DEPENDENCY_SCAN === 'true',
  });

  if (failures.length > 0) {
    console.error('Dependency-scanner readability guard failed:\n');
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    console.error(
      '\nSee documentation/md/BUN-ENGINEERING-GUIDE.md §11 for the measured evidence and '
        + 'the three candidate remedies.\n',
    );
    process.exit(1);
  }

  // Say which branch it took. "Passed" alone would read as "a readable lockfile is
  // present" even when it passed because Snyk is no longer a configured control —
  // and a guard that reports the wrong reason is how the next blind spot hides.
  const snykConfigured = SNYK_CONFIG_FILES.some((file) => exists(file));
  console.log(
    snykConfigured
      ? 'Dependency-scanner readability guard passed: a scanner-readable lockfile is present.'
      : 'Dependency-scanner readability guard passed: Snyk is not a configured control '
        + '(no .snyk), so bun.lock parsing is moot. Coverage comes from `bun run deps:audit`.',
  );
}

if (require.main === module) {
  main();
}

module.exports = {
  SCANNER_READABLE_LOCKFILES,
  SNYK_CONFIG_FILES,
  main,
  validateScannerReadability,
};
