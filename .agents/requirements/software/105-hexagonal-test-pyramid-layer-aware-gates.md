# Requirement 105 - Hexagonal Test Pyramid, Layer-Aware Gates

- Status: Active
- Nature: NFR (testing, false-green resistance)
- Source: Linear project `Hexagonal Test Pyramid — Bun unit + Node integration + layer-aware gates` (`7f9e4a32-3b2c-4b0a-86e0-7430bb31076d`)
- Related: Requirement `106` (local Bun for all tests; Node CI-only)

## Requirement

1. **Runtime partition is governed by Requirement `106`.** Locally, every suite type runs on Bun. Node/Jest is reserved for CI via `ciRunner: "node"` / `JUMENTIX_TEST_RUNTIME=node`. This requirement no longer mandates Node for integration locally.
2. Suites are owned by hexagonal layers declared in `test-map.json`: `contracts`, `domain`, `application`, `adapters/in`, `adapters/out+infra`, `interface/runtime`, plus declared non-hexagonal kinds: `tooling` and `service-management/server` + `service-management/designer` (JUM-552 taxonomy; JUM-472 registration — a zero-build SPA plus static server has no hexagonal layers, so it is filed as its own kind with its real internal split, and the canonical contract artifacts under `spec/` belong to `contracts` so a contract-shape change reaches the component through reverse dependencies).
3. `dependsOn` points inward. Execution blast radius propagates outward through reverse dependencies.
4. Task branches run only suites in the selected blast radius. `dev` runs full unit (+ contract when present). `main` runs the full matrix. **CI job greenness is out of scope for the Test Pyramid project delivery** (see Req `106` §5).
5. Every selective run emits auditable JSON evidence listing selected layers, deliberately not-run layers, planned suites and terminal suite results. Empty plans for non-empty change sets fail closed.
6. Layer selection uses an alias-aware dependency graph (`@src`, `@test`, `@seed`, `@jumentix/*`). Specifier-only parsers are forbidden for gate decisions.
7. `JUMENTIX_GATE_V2` defaults to on. Rollback is a flag flip (`JUMENTIX_GATE_V2=0`), not a code revert. Shadow mode (`JUMENTIX_GATE_V2_SHADOW=1`) may run v2 report-only while v1 remains authoritative.
8. Quarantine entries must reference a real path and a Linear issue (`JUM-*`). Skipped/pending/unreported suite statuses are not green. Quarantined suites still run report-only.
9. Suites that CI may still execute under Node MUST declare `ciRunner: "node"` in `test-map.json`. Local `runner` MUST be `"bun"` (Req `106`).

## Evidence

- `test-map.json`
- `ci-cd/check-test-map.js`
- `ci-cd/lib/test-map.js`
- `ci-cd/lib/layer-resolver.js`
- `ci-cd/lib/gate-evidence.js`
- `ci-cd/lib/test-runtime.js`
- `ci-cd/run-task-change-tests.js`
- `ci-cd/run-unit-tests.js`
- `ci-cd/run-suite.js`
- `documentation/md/HEXAGONAL-TEST-PYRAMID.md`
- `documentation/md/HEXAGONAL-TEST-PYRAMID.pt-BR.md`
