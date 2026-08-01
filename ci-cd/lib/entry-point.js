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
  // `!= null` covers undefined and null in one comparison. Writing them as two
  // strict checks made the second always true — `require.main` is
  // `Module | undefined` and never null — which is dead code wearing the look of
  // a second safety check.
  return entry != null && entry === caller;
}

/**
 * Run `execute` only when `caller` is the process entry point, and report its
 * result as the exit code.
 *
 * The guard has to be a function, not a bare `if (isEntryPoint(module))` block:
 * inline, it is unreachable from any suite — a test runner always *imports* the
 * file — so the one line deciding whether a gate binds at all goes unverified.
 * Each guard here writes its own `main()` and calls this; the module-scope call
 * executes on import, so both halves are covered.
 *
 * It lives beside `isEntryPoint` because it had been written four separate times
 * in a single afternoon — once per new guard, each a copy of the last. Sonar
 * called it: `new_duplicated_lines_density` at 4.7% against a 3% budget, on a
 * change that added no duplication anyone had noticed writing.
 *
 * @param {object} options
 * @param {NodeModule} options.caller The calling file's own `module`.
 * @param {NodeModule|undefined} [options.entry] The process entry module,
 * injected only for tests — see `isEntryPoint`.
 * @param {() => number} options.execute Runs the guard, returns an exit code.
 * @param {(code: number) => void} [options.exit] Where the code goes.
 * @returns {boolean} true when it ran, false when the module was only imported.
 */
function runWhenEntryPoint(options) {
  const {
    caller,
    entry = require.main,
    execute,
    exit = (code) => { process.exitCode = code; }
  } = options;

  if (!isEntryPoint(caller, entry)) return false;
  exit(execute());
  return true;
}

module.exports = { isEntryPoint, runWhenEntryPoint };
