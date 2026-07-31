# Test Pyramid rollout report & rollback plan (JUM-448)

Date: 2026-07-30  
Project: Hexagonal Test Pyramid (`7f9e4a32-3b2c-4b0a-86e0-7430bb31076d`)

## Delivered

| Wave | Content | Status |
| --- | --- | --- |
| Foundation | Req 105/106, `test-map.json`, anti-drift, Users pilot layer folders | Shipped |
| Selective gates | `JUMENTIX_GATE_V2`, alias-aware resolver, evidence JSON, shadow | Shipped |
| Bun local all-tests | Req 106 — unit/integration/smoke/contract via Bun locally | Shipped |
| Node CI-only | `ciRunner` + `JUMENTIX_TEST_RUNTIME=node` + `*:ci` scripts | Shipped (CI green out of scope) |
| Nightly tier | `tier: nightly` + `bun run test:nightly` | Shipped (scheduler out of scope) |
| Workspace honesty | `workspace:test` + `jumentix.testSurface` | Shipped |

## Benchmarks vs Phase 0 baseline

See `artifacts/ci/baseline-timings.json` and `artifacts/ci/benchmark-report.json`.

Targets (project plan):

| Metric | Target | Notes |
| --- | --- | --- |
| Task-gate time | < 60s after Bun swap | Measured locally; CI wall-clock out of scope |
| Full unit | < 5 min | Bun local path |
| Escalation rate | < 30% PRs | Requires production traffic; tracked post-rollout |
| Shadow miss-rate | 0 | Enforced by evidence validator |
| Flake rate | < 0.5% | See `artifacts/ci/flake-inventory.json` |

Honest statement: remote CI timings were **not** used as acceptance evidence because CI functioning is out of scope for this project (Req 106 §5).

## Rollback plan (exercised as a flag flip)

1. **Selector rollback:** `JUMENTIX_GATE_V2=0` restores v1 task planning without code revert.
2. **Runtime rollback for a suite:** set `ciRunner`/`JUMENTIX_TEST_RUNTIME=node` for CI; local remains Bun unless an operator exports the env locally.
3. **Quarantine:** `bun run quarantine:flake --path <suite> --reason "..." --create-issue` adds report-only quarantine with Linear ref.
4. **Manifest rollback:** regenerate from git history of `test-map.json` / `ci-cd/generate-test-map.js`.

## Residual risks

- Some Jest-oriented integration tests may still fail under `bun test` until suite code is adapted — that is suite debt, not a reason to keep Jest as the local default.
- Nightly infra (Redis/DB) must be owned by CI operations.
