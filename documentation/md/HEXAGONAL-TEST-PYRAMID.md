# Hexagonal Test Pyramid — layer-aware gates (Bun local, Node CI-only)

## Outcome

Fast, architecture-aligned tests:

- **Locally, all suite types run on Bun** (`bun test` / `bun run test*`) — unit, integration, smoke, contract and workspace verification (Requirement `106`).
- **Node/Jest is CI-only**, selected with `JUMENTIX_TEST_RUNTIME=node` or `CI=true`, or via explicit `*:ci` scripts.
- Feature/task branches run only the suites covering changed layers and their outward blast radius.
- Making remote CI jobs green is **out of scope** for this project; the contract and entry points are delivered here.

Requirements:

- `.agents/requirements/105-hexagonal-test-pyramid-layer-aware-gates.md`
- `.agents/requirements/106-local-bun-all-tests-node-ci-only.md`

## Manifest

`test-map.json` is the machine-readable source of truth:

| Field | Meaning |
| --- | --- |
| `layers.*.dependsOn` | Inward hexagonal dependencies |
| `layers.*.sourceGlobs` | Source ownership predicates |
| `suites[].runner` | **Local** runner — always `bun` (Req 106) |
| `suites[].ciRunner` | Optional CI runner (`node` when Jest is still required remotely) |
| `suites[].tier` | `gate` or `nightly` |
| `quarantine[]` | Explicit exceptions with Linear issue refs |
| `flags.gateV2Env` | `JUMENTIX_GATE_V2` (default on) |

```bash
bun run test-map:check
bun run test-map:generate
```

## Local DX (Bun)

```bash
bun run test                 # all backend-template tests under bun:test
bun run test:unit            # unit gate via test-map (Bun local)
bun run test:integration:express
bun run test:contract
bun run tdd                  # watch layer inferred from git diff
bun run tdd:domain           # per-layer watch from manifest paths
bun run workspace:test       # honest workspace cell (typecheck-only ≠ unit)
```

Force the CI Node path locally only when debugging CI behaviour:

```bash
JUMENTIX_TEST_RUNTIME=node bun run test:integration:express
# or
bun run test:integration:express:ci
```

## Layer-aware task gate

`bun run ci:gate:task` uses the v2 selector when `JUMENTIX_GATE_V2` is unset/true.

1. Read changed files.
2. Resolve alias-aware dependents (`@src`, `@test`, `@seed`, `@jumentix/*`).
3. Map files → layers via `test-map.json`.
4. Expand outward through reverse `dependsOn`.
5. Execute selected suites through the runtime resolver (Bun local / Node when CI).
6. Emit JSON evidence including **not-run** layers.

Rollback: `JUMENTIX_GATE_V2=0`. Shadow: `JUMENTIX_GATE_V2_SHADOW=1`.

## Nightly tier

Infrastructure-heavy suites (`mutex`, redis-streams, DB smoke) use `tier: "nightly"`.

```bash
bun run test:nightly
```

Scheduling those jobs in GitHub Actions is CI operations scope, not this project.

## Anti-false-green rules

- Empty planned suites for a non-empty change set → fail.
- Planned suite missing from executed results → fail.
- `skipped` / `pending` / unreported suite status → fail.
- Stale `test-map.json` → fail via `test-map:check`.
- Workspace packages without unit tests declare `jumentix.testSurface=typecheck-only` and are not counted as unit greens (`workspace:test`).

## Rollout / benchmarks

See:

- `artifacts/ci/baseline-timings.json` (JUM-495)
- `artifacts/ci/flake-inventory.json` (JUM-495)
- `documentation/md/BUN-BRANCH-COVERAGE-SPIKE.md` (JUM-541)
- `documentation/md/TEST-PYRAMID-ROLLOUT-REPORT.md` (JUM-448)
- `documentation/md/PLATFORM-DEPENDENT-SUITES.md` (JUM-439)
