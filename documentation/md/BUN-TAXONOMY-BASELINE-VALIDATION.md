# JUM-432 / JUM-433 — Bun baseline & toolchain vs layer taxonomy

## JUM-432 — Project JUM-23 onto the layer taxonomy

Historical baseline summary: `documentation/md/HISTORICAL-TRANSITIONS.md` (JUM-23).

| Layer | Bun-ready posture (local, Req 106) | Notes |
| --- | --- | --- |
| `contracts` | bun | Governance checks via `bun run test:contract` |
| `domain` | bun | Primary Bun win; Users pilot under `test/unit/modules/Users/domain` |
| `application` | bun | Includes former `service`/`events`/`features` test folders |
| `adapters/in` | bun local / `ciRunner:node` | HTTP adapter integration retained for CI Node |
| `adapters/out+infra` | bun local / `ciRunner:node` for smoke/mutex | Nightly tier for infra |
| `interface/runtime` | bun local / `ciRunner:node` | Realtime suites |
| `tooling` | bun | ci-cd / website / generators |

Migration order remains inward→outward: domain → application → adapters → interface → nightly infra.

## JUM-433 — Pinned Bun satisfies pyramid DX needs

Pin: Bun `1.3.13`.

| Need | Verified |
| --- | --- |
| Path-scoped `bun test --watch` | Yes — `bun run tdd:<layer>` / `ci-cd/run-tdd.js` |
| LCOV reporter | Yes — `bun test --coverage --coverage-reporter=lcov` |
| Layer path derivation from manifest | Yes — no hardcoded globs in tdd scripts |

Gaps are filed against the Bun epic toolchain issues, not duplicated here.
