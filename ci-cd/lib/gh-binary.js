/**
 * Resolve the `gh` CLI to an absolute path (Sonar javascript:S4036).
 * Same rationale as ci-cd/lib/git-binary.js: never spawn the bare name `gh`.
 */
const fs = require('node:fs');

const GH_CANDIDATES = Object.freeze([
  '/usr/bin/gh',
  '/bin/gh',
  // Absolute install locations (not PATH). Prefer /usr/bin on CI images.
  '/opt/homebrew/bin/gh',
  '/usr/local/bin/gh'
]);

let cached = null;

function resolveGhBinary(candidates = GH_CANDIDATES, exists = fs.existsSync, env = process.env) {
  if (env.GH_BIN && exists(env.GH_BIN)) return env.GH_BIN;
  for (const candidate of candidates) {
    if (exists(candidate)) return candidate;
  }
  throw new Error(
    'Could not find gh in a fixed system location '
      + `(looked in: ${candidates.join(', ')}).\n`
      + '  Release jobs resolve gh by absolute path on purpose so PATH cannot\n'
      + '  shadow the real CLI. Install the GitHub CLI, set GH_BIN to an absolute\n'
      + '  path, or add its location to GH_CANDIDATES in ci-cd/lib/gh-binary.js.'
  );
}

function ghBinary() {
  cached ??= resolveGhBinary();
  return cached;
}

function resetGhBinaryCache() {
  cached = null;
}

module.exports = {
  GH_CANDIDATES,
  ghBinary,
  resetGhBinaryCache,
  resolveGhBinary
};
