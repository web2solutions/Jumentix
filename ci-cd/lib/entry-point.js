/**
 * Whether a module is the one the process was started with.
 *
 * Every guard in `ci-cd/` is both a CLI and a library: it exports pure functions
 * for its unit suite and runs `main()` when invoked directly. The canonical Node
 * expression for that is `require.main === module`, written inline in 32 files.
 *
 * It is here for two reasons.
 *
 * **It is one definition rather than 32.** The expression is subtle enough to
 * get wrong — `module.parent === null` is the deprecated alternative and behaves
 * differently under ESM — and a wrong copy fails silently: the script simply
 * does nothing when run, or runs its side effects when imported by a test.
 *
 * **`require.main` is genuinely optional.** It is `undefined` when the process
 * was not started from a module at all — `bun -e`, a REPL, an embedded host. The
 * inline form compared `Module | undefined` against `Module` without saying so,
 * which is also why SonarQube reported it as a bug (`javascript:S3403`,
 * "this === check will always be false"). The comparison was correct; the
 * nullability was implicit. Here it is explicit, and the rule has nothing to
 * object to.
 */

/**
 * @param {NodeModule} caller The calling file's own `module`.
 * @param {NodeModule|undefined} [entry] The process entry module. Injected only
 * for tests: the two runners disagree about what `require.main` is inside a test
 * file — under `bun test --isolate` each file is its own entry, under Jest it is
 * `undefined` — so the positive case is untestable without it.
 * @returns {boolean} true when `caller` is the process entry point.
 */
function isEntryPoint(caller, entry = require.main) {
  return entry !== undefined && entry !== null && entry === caller;
}

module.exports = { isEntryPoint };
