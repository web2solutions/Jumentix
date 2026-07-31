# Hexagonal Test Pyramid — Bun unit + Node integration + layer-aware gates

## Outcome

Fast, reliable tests that mirror the hexagonal architecture:

- **Unit** suites run on **Bun** (`bun:test`) for speed.
- **Integration / smoke / platform** suites run on **Node 22 + Jest** for compatibility.
- Feature/task branches run only the suites covering changed layers and their outward blast radius.
- `dev` runs the full unit gate; `main` runs the full matrix.

Requirement: `.agents/requirements/105-hexagonal-test-pyramid-layer-aware-gates.md`.

## Manifest

`test-map.json` is the machine-readable source of truth:

| Field | Meaning |
| --- | --- |
| `layers.*.dependsOn` | Inward hexagonal dependencies |
| `layers.*.sourceGlobs` | Source ownership predicates |
| `suites[]` | Every runnable test file, with `layer`, `type`, `runner`, `tier` |
| `quarantine[]` | Explicit exceptions with Linear issue refs |
| `flags.gateV2Env` | `JUMENTIX_GATE_V2` (default on) |

Validate with:

```bash
bun run test-map:check
```

Regenerate after adding suites:

```bash
bun run test-map:generate
bun run test-map:check
```

## Layer-aware task gate

`bun run ci:gate:task` uses the v2 selector when `JUMENTIX_GATE_V2` is unset/true.

Algorithm:

1. Read changed files (`staged` or `range` via `JUMENTIX_TASK_TEST_MODE`).
2. Resolve alias-aware dependents (`@src`, `@test`, `@seed`, `@jumentix/*`).
3. Map files → layers via `test-map.json`.
4. Expand outward through reverse `dependsOn`.
5. Execute Bun unit suites + targeted Node integration scripts.
6. Emit JSON evidence (`AAA_CI_GATE_RESULT_FILE`) including **not-run** layers.

Rollback without reverting code:

```bash
JUMENTIX_GATE_V2=0 bun run ci:gate:task
```

Shadow (v1 authoritative, v2 report-only):

```bash
JUMENTIX_GATE_V2=0 JUMENTIX_GATE_V2_SHADOW=1 bun run ci:gate:task
```

## Runtime partition

`bun run test:unit` reads `test-map.json` and:

1. Runs `runner: "bun"` unit suites with `bun test`.
2. Runs `runner: "node"` unit suites with Jest (temporary Bun API-gap partition).

Integration remains Node/Jest through `bun run ci:integration` / per-adapter scripts declared in the manifest.

## Anti-false-green rules

- Empty planned suites for a non-empty change set → fail.
- Planned suite missing from executed results → fail.
- `skipped` / `pending` / unreported suite status → fail.
- Stale `test-map.json` (missing files, cycles, double ownership) → fail via `test-map:check`.
