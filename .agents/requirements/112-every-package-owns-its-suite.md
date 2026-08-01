# 112 - Every Package and App Owns Its Suite

- Status: Active
- Nature: NFR (testing, architecture, CI/CD)
- Source: Project owner decision, 2026-08-01.
- Relates to: `020` / `063` (coverage thresholds), `065` (fail-closed), `105` (layer-aware gates), `110` (runner and coverage instrument).

## Requirement

1. **Every workspace package and every app owns a test suite covering its own
   source**, held to the project's 99% standard. A package whose only coverage
   comes from an application's tests is not tested — the application is.

   The distinction is invisible in an aggregate number and decisive in practice.
   Change the library, and the suite that would catch the break belongs to
   another workspace, runs on another schedule, and passes for reasons unrelated
   to the change. Coverage borrowed from a consumer measures the consumer.

2. **Packages do not depend on one another's suites in the development
   workflow.** A change to one package runs that package's suite, plus whatever
   the layer-aware selector proves is impacted (Requirement `105`). Running the
   whole repository for a small commit is not thoroughness; it is a tax that
   pushes people to skip the gate.

3. **The full matrix runs on the release to `main`, not on every commit.**
   `ci:gate:branch` selects; `ci:gate:strict` runs everything. The strict matrix
   is the release gate, and it is the only place the whole of every package and
   app is expected to run.

4. **A package that runs in a browser is verified in a real browser**, headless,
   through Cypress — **with no shims and no fake libraries**. Not as an addition
   to a Node harness: as its replacement.

   `packages/cana` is the current case. It drives IndexedDB, IndexedDB is a
   browser API, and its eighteen suites run today under `fake-indexeddb` in Node.
   A reimplementation agrees with the real thing exactly where someone thought to
   make it agree, and the behaviours worth testing here are the ones least likely
   to be reproduced: quota and eviction, upgrade blocking while another tab holds
   the connection, the structured-clone boundary, what a real transaction does
   when it auto-commits. A suite that passes against a fake and fails against
   Chrome proves the fake, and it took a real `MessageChannel` to find that
   `expect(...).resolves` deadlocks on a port-settled promise — a fake port never
   showed it.

   This is a replacement, so it is not free: the Node suites and their
   `fake-indexeddb` dependency come out when the Cypress suite lands, and the
   coverage contract in §1 is met by the browser run, not by the two together.

5. **Debt is declared, dated and tracked, and the declaration ratchets.**
   `ci-cd/check-package-suites.js` fails on a package with source and no suite
   that is not declared in `WITHOUT_SUITE_YET`, and **equally on a declared
   package that has since grown one**. The second direction is what keeps the
   register from becoming a permanent exemption: an entry that has done its job
   has to leave, or the list stops describing anything.

   Each entry carries a `since` date, a tracking `issue`, and a `reason`. "No
   time yet" is a reason; the absence of one is not.

6. **The Sonar coverage exclusions and the debt register are the same list.**
   Sonar reports a source file absent from the lcov as 0% covered, which is the
   right default and the wrong number when the report was never scoped to that
   file. Before this requirement, Sonar reported 46.3% for a project whose
   measured scope sat at 99.0%.

   So each declared package is excluded from Sonar's coverage metric, and the
   check fails when the two lists disagree in either direction — a declared
   package Sonar still measures fails the gate for a gap already recorded; a
   package Sonar ignores without a declaration is hidden with nothing saying why.

## Rationale

The monorepo grew with one suite at the application layer and libraries beneath
it. That reads as economical — the code is exercised either way — and it quietly
moves the cost from writing tests to diagnosing failures. A break in
`key-value-storage` surfaces as a failing HTTP integration test three layers up,
and the person reading it starts at the wrong end.

It also makes the aggregate number a poor guide. 99% across the measured scope
said nothing about thirteen packages that had no suite at all, because the scope
had been narrowed until the statement was true.

## Verification

- `bun run packages:check-suites` — runs the register and the ratchet.
- The check runs inside `ci:gate`, so it gates every branch through both CI
  providers (Requirement `107`).
- `apps/backend-template/test/unit/ci-cd/check-package-suites.test.ts` proves it
  fails on an undeclared package, on a declared package that has grown a suite,
  on each malformed declaration, and when the two lists disagree — against
  throwaway workspaces rather than the repository's own layout.

## Outstanding

Thirteen packages owe a suite, each declared with a date and an issue
(`JUM-585`). `packages/cana` owes a headless-browser suite under §4.
