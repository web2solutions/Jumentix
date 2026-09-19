# 137 - Workspace Suite and Tooling Ownership Placement

- Status: Active
- Nature: NFR (testing, architecture, CI/CD, governance)
- Source: Linear epic "Workspace suite, gate and tooling ownership"
  (JUM-824…838), 2026-09-18.
- Relates to: `062` (workspace import boundaries), `112` (every package owns
  its suite), `124` (tests scoped by owning project), `126` (SM ownership and
  config path pin), `105` (layer-aware gates), `065` (fail-closed).

## Requirement

1. **A suite lives in the workspace of the code it asserts.**  
   - `apps/<A>/test/**` asserts `apps/<A>` (or consumes `@jumentix/*` public
     APIs as consumer wiring without deep-importing `packages/*/src` as a unit
     clone).  
   - `packages/<P>/test/**` asserts `packages/<P>` only.  
   - `ci-cd/test/**` asserts root `ci-cd/**` monorepo gates, runners, test-map
     and release tooling only.

2. **Monorepo gates and runners live under `ci-cd/`.** Component-specific
   scripts live in the owning component (`apps/<A>/scripts/`,
   `packages/<P>/scripts/` or `bin/`). Root `package.json` keeps every public
   script name and delegates to the new location — no public name is removed.

3. **Dual-home ban.** The same package behaviour must not be asserted from both
   `packages/<P>/test` and an app unit suite that only exercises a pure
   `@jumentix/<P>` re-export or deep-mocks `packages/<P>/src`. Template
   *composition* suites that wire app adapters stay under the app.

4. **Machine gate.** `bun run arch:check-ownership-placement` runs
   `ci-cd/check-workspace-ownership-placement.js`. It fails closed on
   misplaced suites and on stale allow-list entries. Task mode
   (`--changed`) limits the scan to suites touching changed files.

5. **Shrink-only allow-list.** `ci-cd/ownership-placement-allowlist.json`
   entries are `{ "suite", "assertsWorkspace", "reason", "issue" }`. An entry
   whose suite no longer exists fails. The steady state after this epic is an
   empty array.

6. **Mandatory cleanups (acceptance of this requirement).** Tracked Issues:
   - JUM-827 / JUM-828 — dual-path discovery; SM suites + harness under
     `apps/service-management`
   - JUM-829 / JUM-830 — `ci-cd/test` suite root; move tooling suites out of
     `apps/backend-template/test/unit/ci-cd`
   - JUM-831 — audit `infra` / `sdk-clients` dual homes (stay / move / delete)
   - JUM-832 — wire the gate into `ci:gate` and branch preflight
   - JUM-836 — component-specific scripts leave root `ci-cd/`
   - JUM-837 — backend-template-only scripts under
     `apps/backend-template/scripts/`
   - JUM-833 / JUM-838 / JUM-835 — proof suite, path sync, Req `094` handoff

7. **Req `126` config path pin is unchanged.** Service Management may
   path-resolve `apps/backend-template/src/config`; it must never module-import
   backend-template source or use `@src/` from SM suites.

## Validation

- Gate script: `ci-cd/check-workspace-ownership-placement.js`
- Allow-list: `ci-cd/ownership-placement-allowlist.json`
- Proof suite: `ci-cd/test/check-workspace-ownership-placement.test.ts`
- Wired into `ci:gate` and branch/task preflight (JUM-832)
- `bun run requirements:check` lists this file
