# Requirement 066 - Documentation Round: Marketing Root + Component Technical Docs

## Context
- Jumentix monorepo requires split documentation ownership:
  - root documentation is product/marketing oriented
  - component documentation is technical and implementation oriented
- Navigation must remain centralized through root README index.
- Linear is the canonical source of truth for documentation tasks (Requirement `095`).

## Mandatory Rules
1. Root `README.md` must keep badges and include product purpose, audience, value proposition, and advantages.
2. Root `README.md` must contain index links to every major component documentation hub.
3. Component docs must live under each component folder (`apps/*`, `packages/*`, `tooling/*` when applicable).
4. Mandatory solution sections must exist and be linked from root docs:
   - SPA/PWA
   - REST API
   - Realtime API
   - SaaS monolith
   - SaaS microservices
5. Documentation work must be tracked as Linear issues under the documentation epic (Requirement `095`).

## Audience Matrix (amendment 2026-09-26, JUM-892)

Every documentation surface serves exactly one reader. Before a line is written, the author
names that reader and writes only for them. A fact lives in exactly one layer; every other
layer links to it instead of repeating it.

| Layer | Files | Reader | Register |
| --- | --- | --- | --- |
| Prospect | `README.md`, `README.pt-BR.md`, every `apps/jumentix-website` commercial page (`components/**`, `app/**`) | someone deciding whether to try Jumentix | outcomes and benefits; no internal mechanics, requirement numbers, issue ids, or CI/gate control variables |
| Developer | website `/docs/**` pages (`apps/jumentix-website/content/**`) | an engineer integrating Jumentix | precise and technical; links to contributor docs for governance instead of restating it |
| Contributor | `documentation/md/**`, component `README.md` files under `apps/*`, `packages/*`, `tooling/*` | someone building Jumentix | precise and technical; may reference requirements by number when linking to `.agents/requirements/**` |
| Agent / internal | `.agents/**` | an agent executing governance | normative rules; never mirrored or paraphrased into a prospect or developer file |

Website `/docs/**` pages live on the marketing site but belong to the developer layer and
stay visually distinct from commercial pages.

Requirements `018` and `024` ask the README to reflect architecture, runtime and quality
gates. In the prospect layer that obligation is met by linking to the contributor documents
that own those facts, not by restating their mechanics.

## Internal Governance Vocabulary (amendment 2026-09-26, JUM-892)

The following must never appear in the prospect or developer layers:

1. CI and gate control variables: `JUMENTIX_ENABLE_GITHUB_ACTIONS_CI`,
   `JUMENTIX_QUALITY_GATE_TARGET`, `JUMENTIX_GATE_V2`, `JUMENTIX_GATE_V2_SHADOW`,
   `JUMENTIX_TEST_RUNTIME`. Runtime configuration keys such as `JUMENTIX_HTTP_FRAMEWORK`
   are public product configuration (Requirements `043`, `126`) and are not in this list.
2. CI-provider canonical/fallback mechanics (which provider is canonical, which is
   retained, how to re-enable it).
3. Requirement numbers used as the reason for something. A public page may link to a
   contributor document; it may not restate a requirement's rule or cite its number.
4. Linear issue ids (`JUM-NNN`) and paths into `.agents/`.

Source-code comments in website components are contributor-facing and are exempt; the
strings they render are not.

## Enforcement (amendment 2026-09-26, JUM-892)

- `bun run docs:check-audience` runs `ci-cd/check-documentation-audience.js`. It scans the
  prospect and developer layers for the vocabulary above and fails naming file, line, layer
  and rule. It runs in `ci:gate` and as a branch-gate preflight, so every CI context
  executes it.
- Known offenders are held in `ci-cd/documentation-audience-allowlist.json`, one entry per
  file and rule with the owning issue and a reason. The register is shrink-only: an entry
  whose file is gone or no longer matches fails the gate. The steady state is an empty array.
- Proof suite: `ci-cd/test/check-documentation-audience.test.ts` fails on the README leak
  that shipped before this amendment and passes once it is removed.

## Acceptance Criteria
- Root README index has no broken links to component hubs and mandatory guides.
- Component technical hubs exist and include actionable technical navigation.
- Epic and child tasks are present in Linear with labels/priorities.
- `bun run docs:check-audience` passes with every remaining allow-list entry owned by an
  open issue.
