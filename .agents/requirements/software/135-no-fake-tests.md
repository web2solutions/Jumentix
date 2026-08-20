# Requirement 135 - No Fake Tests

## Context

A fake test is worse than a missing one. A missing test is visible in a
coverage report; a fake test is a green tick that says a thing works.

Found in this repository:

- **38 of 296 suites had no `expect.hasAssertions()`.** A test whose assertion
  never runs — inside an unentered branch, after an unawaited promise — passes.
- **A replay handler that ignored `response.error`.** `UserService` reports
  failure in a field rather than throwing, so a handler that merely called it
  would mark a still-locked record `succeeded`, lose the write, and report that
  it landed (JUM-53).
- **`packages/cana/coverage-100.cy.ts`**, a suite whose stated purpose is a
  number. Tests written to reach a percentage assert what is easy to assert.
- **A queue drain asserted by the queue being empty**, rather than by the row
  the replay was supposed to write.
- **A route sweep that filtered on `display: 'hidden'`**, a flag that happened
  to name the broken pages, so it stayed green while they 404ed (JUM-640).
- **A suite matching zero files** would have run nothing and reported success,
  which is why `run-suite.js` fails on an unmatched path.

## Mandatory Rules

1. **Assert the effect, not the call.** `toHaveBeenCalled` says a function ran.
   Whether the write landed is a different question, and it is the one that
   matters. Mock assertions are permitted alongside a state assertion, not
   instead of one.
2. **Every test declares that it asserts.** `expect.hasAssertions()`, or the
   suite's equivalent, in every test.
3. **A guard ships with the failure it prevents.** A check, gate or validator
   is accompanied by a test that fails when the defect returns — run against
   the defective input, not only the fixed one.
4. **Coverage is a consequence, never a target.** No suite exists to move a
   percentage. A line that cannot be reached by a meaningful scenario is
   evidence about the code, not a reason for a synthetic test.
5. **No test asserts on a double where the real thing is available.** Doubles
   are for what cannot be run in the suite — a broker, a paid API, a clock.
   Where a real Redis, a real database or a real browser is already part of the
   pipeline, the behaviour is measured against it (Requirement `115`).
6. **A skipped suite is not a passing suite.** A suite that skips itself when
   its dependency is absent states so in its own text, and the job that is
   supposed to run it fails when it did not.
7. **The proxy is named.** Where a test asserts on something correlated with
   the behaviour rather than the behaviour itself, the comment says so and says
   what would distinguish them (Requirement `130` §3).

## Acceptance Criteria

1. `bun run test:integrity` passes: no suite without assertion declarations, no
   suite outside `test-map.json`, no mock-only suite.
2. Every `ci-cd/check-*.js` has a negative control in its suite.
3. No suite name or comment refers to a coverage percentage as its purpose.

## Evidence and Scope

- Applies to every suite in the monorepo, including Cypress.
- Machine-verifiable in part: `ci-cd/check-test-integrity.js`, **a preflight of
  every branch-gate path since JUM-683**. It was added to the `ci:gate` script
  first, and that script is not what CI runs: the branch gate selects
  `ci:gate:strict`, `ci:gate:task` or `test:unit`, and the check was in none of
  the three, so it ran nowhere for eleven days. Its assertion rule is **per test since JUM-702**:
  the check parses each suite and names the file, line and title of any test
  that does not declare, counting a declaration made once in a `beforeEach` or
  `beforeAll` of an enclosing `describe`.
- Rules `1`, `4` and `7` are judgement, and are attestation in the manner of
  `130`.
- Complements requirements `112`, `115`, `130`, `134`.
