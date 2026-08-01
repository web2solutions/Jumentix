/**
 * Resolve the `git` executable to an absolute path instead of leaving it to PATH.
 *
 * Spawning the bare name `git` makes the operating system search PATH, and PATH
 * is inherited from whoever started the process. A writable directory earlier in
 * that list — `./node_modules/.bin`, a stale `~/bin`, anything a postinstall
 * script dropped — shadows the real binary, and every checker here that asks git
 * a question would then be asking that instead. The answers these checkers get
 * decide whether a commit is authorized and which tests are considered changed,
 * so a shadowed `git` is a lie the pipeline cannot detect.
 *
 * Sonar reports the bare-name form as `javascript:S4036`. The rule is right, and
 * this is the fix rather than a suppression: candidates are root-owned locations
 * only, and resolution fails closed when none of them exists — a checker that
 * cannot be sure which binary it is running should stop, not guess.
 */

const fs = require('node:fs');

/**
 * Root-owned locations, most specific first.
 *
 * `/usr/local/bin` and `/opt/homebrew/bin` are deliberately absent: on macOS
 * they are group-writable by default, which is the exact property that makes
 * PATH resolution unsafe. Every environment this repository runs in — the
 * `oven/bun` CI image, GitHub's runners, and macOS with the Xcode command line
 * tools — provides `/usr/bin/git`.
 */
const GIT_CANDIDATES = Object.freeze([
  '/usr/bin/git',
  '/bin/git'
]);

let cached = null;

function resolveGitBinary(candidates = GIT_CANDIDATES, exists = fs.existsSync) {
  for (const candidate of candidates) {
    if (exists(candidate)) return candidate;
  }

  throw new Error(
    'Could not find git in a fixed system location '
      + `(looked in: ${candidates.join(', ')}).\n`
      + '  This resolves git by absolute path on purpose: searching PATH lets a writable\n'
      + '  directory shadow the real binary, and these checks trust what git tells them.\n'
      + '  If git lives elsewhere on this machine, add that path to GIT_CANDIDATES in\n'
      + '  ci-cd/lib/git-binary.js — and only if it is root-owned.'
  );
}

/** Memoised for callers that spawn git repeatedly; the filesystem does not move. */
function gitBinary() {
  cached ??= resolveGitBinary();
  return cached;
}

/** Test seam: drop the memoised value so a suite can vary the candidate list. */
function resetGitBinaryCache() {
  cached = null;
}

module.exports = {
  GIT_CANDIDATES,
  gitBinary,
  resetGitBinaryCache,
  resolveGitBinary
};
