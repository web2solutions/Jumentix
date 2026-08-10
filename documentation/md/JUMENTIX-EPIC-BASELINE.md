# Jumentix Epic — Delivery Baseline and Completion Record

Completion record for the `Jumentix` Linear Project, written to satisfy Requirement `094`
rule 7: project completion evidence must link the completed documentation Issue, its pull
request and commit evidence, and the validation results for documentation integrity.

This document records and links. It does not restate the 102 delivered issues — their
documentation already lives in the specifications and guides referenced below, and
duplicating it here would create a second source that drifts from the first.

## What this epic was

The original product epic, opened before the workspace adopted epic-centred task taxonomy.
Most of its work predates Requirement `094`, which is why it reached 102 completed issues
with no dedicated documentation Issue — the gate did not exist when the epic started.

| nature | delivered |
| --- | --- |
| unprefixed (pre-taxonomy) | 88 |
| Fix | 4 |
| DOC | 4 |
| Governance | 3 |
| CI | 2 |
| Release | 1 |

Three further issues resolved as duplicates. Five issues that had never been scheduled were
moved out before completion rather than closed as delivered:

- `JUM-49` OAuth2/Auth0 login, `JUM-53` dead-letter queue, `JUM-54` Server-Sent Events and
  `JUM-60` React web adapter moved to **[EPIC][Platform] Deferred boilerplate features
  (2024 migration)**. All four were migrated from the original boilerplate repository on
  2024-06-03 and predate the hexagonal restructuring, the Bun migration and the Cana
  adapter, so none should be executed without first checking it is still the right shape.
- `JUM-44` ESLint rule enforcement moved to **[Tooling] Adopt Airbnb Extended ESLint 9 Flat
  Configuration**, where the surrounding work lives.
- `JUM-158` website and Storybook quality gates moved to **[EPIC][Website] Rebuild Jumentix
  OSS product and documentation**, its actual parent.

Moving them is the reason this epic can be completed honestly. Marking unscheduled feature
work as delivered would have been a false completion at project level — the same defect
class Requirement `065` forbids at the gate.

## Canonical documentation for what was delivered

The governed sources, all bilingual:

- `documentation/md/SPEC-GOVERNANCE-AND-TRACEABILITY.md` — branch, PR, promotion and gate
  rules.
- `documentation/md/SPEC-REQUIREMENTS-TRACEABILITY-LEDGER.md` — requirement-to-artifact
  mapping.
- `documentation/md/SPEC-REQUIREMENTS-COVERAGE-STATUS.md` — coverage certification.
- `documentation/md/SPEC-DEVELOPMENT-DRIVEN-INDEX.md` — the specification index.
- `.agents/requirements/` — 129 requirements across `project/` and `software/`.
- `.agents/NFR-REGISTRY.md` — non-functional requirement mapping.

Component and subsystem documentation delivered under this epic and its successors is
indexed from the specification index above rather than listed here, so that adding a
document does not require editing this file to stay accurate.

## Validation

Run against `dev` at the time of writing:

| check | result |
| --- | --- |
| `bun run requirements:check` | 129 files, 129 unique IDs, no duplicates |
| documentation and registry suites | pass |
| bilingual parity, governed documentation | EN and PT-BR present for every governed document |

Five documents under `documentation/md/` have no PT-BR counterpart:
`BUN-BRANCH-COVERAGE-SPIKE`, `BUN-INSTALL-COMPATIBILITY-AUDIT`,
`BUN-TAXONOMY-BASELINE-VALIDATION`, `PLATFORM-DEPENDENT-SUITES` and
`TEST-PYRAMID-ROLLOUT-REPORT`. These are point-in-time investigation reports rather than
governed bilingual documentation, and Requirement `094` rule 4 binds translation to
governed artifacts. They are recorded here so the asymmetry is deliberate and visible
instead of looking like an oversight.

## Related

- [Portuguese version](JUMENTIX-EPIC-BASELINE.pt-BR.md)
- Requirement `094` — epic documentation completion gate.
- Requirement `065` — false greens are forbidden, at the gate and at project level.
