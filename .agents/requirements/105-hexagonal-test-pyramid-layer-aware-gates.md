# Requirement 105 - Hexagonal Test Pyramid, Bun Unit, Node Integration, Layer-Aware Gates

- Status: Active
- Nature: NFR (testing, CI, false-green resistance)
- Source: Linear project `Hexagonal Test Pyramid — Bun unit + Node integration + layer-aware gates` (`7f9e4a32-3b2c-4b0a-86e0-7430bb31076d`)

## Requirement

1. Unit suites run on Bun (`bun:test`) by default. Integration, smoke and platform-dependent suites run on Node 22 / Jest.
2. Suites are owned by hexagonal layers declared in `test-map.json`: `contracts`, `domain`, `application`, `adapters/in`, `adapters/out+infra`, `interface/runtime`, plus non-hexagonal `tooling`.
3. `dependsOn` points inward. Execution blast radius propagates outward through reverse dependencies.
4. Task branches run only suites in the selected blast radius. `dev` runs full unit (+ contract when present). `main` runs the full matrix.
5. Every selective run emits auditable JSON evidence listing selected layers, deliberately not-run layers, planned suites and terminal suite results. Empty plans for non-empty change sets fail closed.
6. Layer selection uses an alias-aware dependency graph (`@src`, `@test`, `@seed`, `@jumentix/*`). Specifier-only parsers are forbidden for gate decisions.
7. `JUMENTIX_GATE_V2` defaults to on. Rollback is a flag flip (`JUMENTIX_GATE_V2=0`), not a code revert. Shadow mode (`JUMENTIX_GATE_V2_SHADOW=1`) may run v2 report-only while v1 remains authoritative.
8. Quarantine entries must reference a real path and a Linear issue (`JUM-*`). Skipped/pending/unreported suite statuses are not green.
9. Suites that cannot yet run under `bun:test` must be explicitly marked `runner: "node"` in `test-map.json` rather than silently remaining on Jest.

## Evidence

- `test-map.json`
- `ci-cd/check-test-map.js`
- `ci-cd/lib/test-map.js`
- `ci-cd/lib/layer-resolver.js`
- `ci-cd/lib/gate-evidence.js`
- `ci-cd/run-task-change-tests.js`
- `ci-cd/run-unit-tests.js`
- `documentation/md/HEXAGONAL-TEST-PYRAMID.md`
- `documentation/md/HEXAGONAL-TEST-PYRAMID.pt-BR.md`
