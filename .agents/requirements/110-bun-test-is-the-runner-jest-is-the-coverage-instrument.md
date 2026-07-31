# 110 - `bun:test` Is the Test Runner; Jest Is the Coverage Instrument

- Status: Active
- Nature: NFR (testing, CI/CD, governance)
- Source: Project owner decision, 2026-07-31.
- Amends: `106` (local Bun for all suite types), `020` / `063` (coverage thresholds).

## Requirement

1. **`bun:test` is the test runner.** Every suite runs under `bun test` unless
   it qualifies for the exception in §5. Jest is not a runner in this repository.

2. **Jest is retained for exactly one job: producing the coverage report.**
   `bun run test:coverage` runs it over the unit suites, and it is the only thing
   Jest is invoked for.

   This is not sentiment about Jest. Bun's lcov output contains **no branch
   records at all** — no `BRF`, no `BRH`, no `BRDA` — because Bun has no branch
   metric and no flag adds one. Requirements `020` and `063` mandate 90% branch
   coverage. A Bun-only pipeline cannot measure it, and the honest choice between
   *losing the metric* and *keeping one tool for one job* is the second.

3. **`ci-cd/check-coverage-thresholds.js` is the authority on all four metrics.**
   It reads `coverage/coverage-final.json` — Istanbul's own format, written by the
   same run that produces the lcov Sonar and Codecov consume — rather than asking
   a runner. Not the lcov itself: **lcov carries no statement counter**, only
   LF/LH, FNF/FNH and BRF/BRH, so a checker reading it reports lines twice under
   two names. That was not academic — on one run Jest measured 98.87% statements
   while an lcov-based check reported 99.10%, and the gate would have passed a
   tree Jest's own threshold rejected. It **fails closed on
   an unmeasured metric**: an absent counter reports as unevaluable, never as
   met. A threshold that cannot be checked is not a threshold, and treating a
   missing counter as satisfied is how one disappears without anyone deciding to
   remove it.

   `bunfig.toml`'s own `coverageThreshold` is a fail-fast inner guard covering
   the three metrics Bun understands. It is not the contract.

   **The thresholds apply over the measured scope, and the scope is part of the
   contract.** `jest.config.js` previously excluded `packages/` entirely, so a
   package with a full test suite reported to Sonar as untested new code
   (JUM-578). `packages/cana/src` is now measured. Narrowing the scope to
   recover a number is not a permitted way to meet a threshold.

4. **A metric may sit below its threshold only under a recorded exception, and
   the exception is a ratchet.** `ACCEPTED_BELOW_THRESHOLD` in the checker holds
   a `floor`, a date, an issue and a reason for each. Coverage at or above the
   floor passes; below it fails, so the concession can be held or improved but
   never spent. Once the metric clears its real threshold the checker **fails
   while the entry remains**, which is what stops a dated concession becoming a
   permanently lowered bar.

   One entry exists today: `statements` at a floor of 98.99% against a 99%
   threshold, since 2026-07-31, tracked as JUM-588. It was granted because
   widening the scope above moved the tree from 99.26% over the old scope to
   98.99% over the new one — the figure fell because the measurement improved.
   What remains uncovered is defensive code behind validators that
   `fake-indexeddb` cannot reach; closing it needs the real-browser conformance
   run (JUM-417).

5. **A suite may declare `runner: "node"` only with a `reason`.** The reason must
   name a concrete incompatibility that prevents the suite loading under Bun —
   not a preference, not a convenience, not "it was easier".

   `check-test-map.js` enforces the `reason`; `run-suite.js` treats the pin as
   authoritative over environment resolution, because a suite that cannot load
   under Bun has no bun runner to fall back to and "prefer bun locally" would
   mean it runs nowhere.

   The current holder of this exception is the **Restify** integration set (22
   suites). Restify pulls `spdy` → `handle-thing` → `process.binding('stream_wrap')`,
   which Bun does not implement (oven-sh/bun#4957). This is upstream and not
   ours to fix.

6. **Requirement `106` is amended, not replaced.** Its rule — local runs use Bun,
   Node is reserved for CI — stands for every suite that can run under Bun. §4
   above adds the declared exception `106` did not have, and §2 records that the
   coverage job is a deliberate Node/Jest boundary under Requirement `096` §4
   rather than a leftover.

## Why the coverage split, rather than dropping branch coverage

Branch coverage is the metric that catches an `if` whose other side is never
taken. That is not a hypothetical concern in this repository — the work that
produced this requirement (JUM-583) found, among others:

- six `expect(async () => ...).rejects.toThrow(...)` assertions with no `await`,
  discarded silently;
- an `if` in `PasswordCryptoService` that resolved a password hash of
  `undefined` and reported success;
- an eleven-branch adapter loader that fell off the end for an unregistered
  framework, starting no server and returning success.

Statement and line coverage were high throughout. Branch coverage is what makes
that class visible, so trading it away to remove one dev-dependency would be a
poor exchange.

## Consequences accepted

- `jest`, `ts-jest` and `@types/jest` remain devDependencies. They are the
  coverage instrument, and `jest.config.js` remains as its configuration.
- `bunfig.toml` keeps `[run] bun = false`. Flipping it would reroute Jest onto
  Bun, and jest-runtime is not Bun-compatible — the measured failure is total:
  every suite dies at load with `TypeError: Attempted to assign to readonly
  property`.
- No test file may import from `bun:test`. Suites must use the globals both
  runners provide, so the coverage run and the test run execute the same code.

## Enforcement

| Rule | Enforced by |
|---|---|
| Four coverage thresholds, fail-closed | `bun run coverage:check` in `ci:gate` |
| Exceptions ratchet, and expire | same checker: below floor fails, above threshold fails |
| `runner: "node"` carries a `reason` | `bun run test-map:check` |
| Map pin beats environment | `ci-cd/run-suite.js` |
| Pinned Bun toolchain | `bun ci-cd/check-bun-version.js` |

## Revisit when

Bun gains branch coverage in its lcov reporter. At that point §2 can be
withdrawn, Jest removed entirely, and `[run] bun = true` reconsidered. Until
then, removing Jest means removing a threshold, and that is a governance
decision rather than a cleanup.
