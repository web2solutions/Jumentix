# Junior docs extension plan — zero → uso pleno, verificado

**Status:** Implemented on PR #184 (2026-08-11) — public allowlist + fail-closed private exclusion  
**Workspace:** `apps/jumentix-website`  
**Related prior work:** [PR #184](https://github.com/web2solutions/Jumentix/pull/184), Linear project [epicdocs-jumentix-website-deep-docs-playgrounds-seoai](https://linear.app/jumentix/project/epicdocs-jumentix-website-deep-docs-playgrounds-seoai-dae8af894bf6)
**Language policy:** EN + pt-BR parity on every page (no orphan locale)  
**Hard rules:** zero GitHub content links in MDX bodies; fail-closed content smoke; no assumed jargon without prior definition or link

---


## 0. Public site package policy (fail-closed)

- If `packages/<name>/package.json` has `"private": true`, the package README is **never** auto-synced onto the website.
- Internal tooling is additionally deny-listed: `config-eslint`, `config-jest`, `config-ts`, `agent-registry`, `security-scanner`, `cli-init`.
- Consumer-facing packages appear only through **explicit** `content-sources.json` entries that point at curated consumer markdown under `documentation/consumers/**` (or public npm package docs such as cana / designer-core hubs).
- Every public package page must include **Responsibility in context / Responsabilidade no escopo**.
- M7 tooling configs are **out of public site scope** (private packages).

## 1. Outcome

Make every package and every application on the Jumentix website teach a junior engineer **from absolute zero to full practical usage**, with **verified** acceptance — not shallow stubs or README mirrors.

**Verified** means each page/package ships with:

| Gate | Requirement |
|------|-------------|
| Locale | EN + pt-BR pages exist and stay in sync |
| Junior checklist | Explicit “I can …” bullets the reader can self-check |
| Examples | Static code always present; DocsPlayground Run/Reset green where Tier allows |
| Evidence | Cypress and/or content-smoke paths listed in DoD and green before Done |
| Glossary | Every term used on the page is defined earlier or linked to a prior step |
| Journey link | Clear next package/app in the learning path |

---

## 2. Page template (mandatory)

Every consumer page follows this structure (EN and pt-BR):

1. **What it is** — one plain-language paragraph  
2. **Why it exists** — problem it solves for a junior team  
3. **Prerequisites** — tools, prior docs pages, runtime assumptions  
4. **Glossary** — terms used on this page (or links to prior definitions)  
5. **Numbered steps** — install → first success (under 30 min) → core workflows → full surface  
6. **Runnable / static example** — static code block always; `<DocsPlayground>` when Tier A/B  
7. **Common errors** — symptoms → cause → fix → how to verify success  
8. **Junior checklist (“I can …”)** — 3–7 measurable outcomes  
9. **Next step** — single recommended next page in the journey  

### Zero → pleno depth levels

| Level | Name | Reader outcome |
|-------|------|----------------|
| L0 | Orient | Knows the problem and when to use the package/app |
| L1 | First success | Install/import/hello works in <30 minutes |
| L2 | Core workflows | Completes the 3–5 workflows juniors need weekly |
| L3 | Full usage | Can use the public surface needed for real work (API map + examples) |
| L4 | Verified | Checklist + smoke/Cypress + EN/pt-BR parity passed |

**Target for every package and app:** L3 content authored + L4 verification recorded. Current inventory is mostly L0–L1.

---

## 3. Root-cause notes (bugs fixed / to verify on deploy)

### 3.1 Marketing white-on-white quote

| Item | Detail |
|------|--------|
| Symptom | Home quote “Jumentix is for teams that want framework speed…” unreadable |
| Component | `components/commercial/CommercialPages.tsx` (`blockquote.classes.quote`) |
| CSS | `components/commercial/CommercialPages.module.css` `.quote` |
| Root cause | Dark mode flips `--jtx-ink` to light (`#edf3fb`) in `tokens.css`, but pastel fills (`--jtx-green-50`, etc.) stayed light. Ink-on-pastel became white-on-white. |
| Fix | (1) Dark-mode pastel tokens in `components/design-system/tokens.css`; (2) quote background uses `color-mix(green-500, surface)` in `CommercialPages.module.css` |
| Verify | Toggle dark scheme on `/` and `/pt-BR`; quote readable; WCAG AA contrast |

### 3.2 SPA/PWA DocsPlayground validate error

| Item | Detail |
|------|--------|
| Symptom | `/docs/pt-BR/jumentix/guides/spa-pwa` (and EN) — Run on designer-core playground errors |
| Catalog | `components/docs-playground/catalogs/index.ts` `DESIGNER_CORE_SNIPPETS` |
| Runtime | `components/docs-playground/runtimes.ts` `loadDesignerCore` |
| Root cause | Snippet passed a toy `{ version, name, entities }` shape into `api.validate`, which was aliased to `collectModelIssues`. Real API expects `{ domains, relationships }` after `normalizeStatePayload` → `state.domains.forEach` throws. |
| Fix | Snippet uses `buildSampleModelPayload` → `normalizeStatePayload` → `collectModelIssues`. Runtime `validate` wraps the real contract and returns `{ ok, issues }`. |
| Verify | Unit test asserts snippet API; manual Run/Reset green on spa-pwa + designer-core usage pages |

---

## 4. Playground tiers (reuse prior epic matrix)

| Tier | Meaning | DocsPlayground? |
|------|---------|-----------------|
| **A** | Browser-safe real or faithful in-memory API | Yes — real package or documented stub |
| **B** | Partial / mock client (no live server required) | Yes — mock factory |
| **C** | Node-only / infra / CLI / CI | No interactive Run — static examples + copy blocks only |
| **D** | App tour / screenshots / guided UI | No code Run — product walkthrough + deep links to package docs |

Current wired runtimes (`DocsRuntimeId`): `cana`, `designer-core`, `key-value-storage`, `message-mediator`, `mutex-service`, `sdk-rest-client`, `sdk-websocket-client`.

---

## 5. Inventory — packages (22)

| Package | Current depth | Target depth | Playground? | Owner milestone | Notes |
|---------|---------------|--------------|-------------|-----------------|-------|
| `@jumentix/cana` | L2 (usage + playground) | L3→L4 | A — yes | M3 Browser/offline | Deepen glossary + full surface map; verify Cypress |
| `@jumentix/designer-core` | L1–L2 (usage + broken→fixed playground) | L3→L4 | A — yes | M3 Browser/offline | Align all snippets with sample/normalize/collect |
| `@jumentix/key-value-storage` | L1–L2 | L3→L4 | A — stub | M4 Persistence | Expand beyond get/set; adapter matrix |
| `@jumentix/message-mediator` | L1–L2 | L3→L4 | A — stub | M5 Communication | Request/response + events junior path |
| `@jumentix/mutex-service` | L1–L2 | L3→L4 | A — stub | M4 Persistence | Multi-lock / failure modes |
| `@jumentix/sdk-rest-client` | L0–L1 (single page + playground) | L3→L4 | B — mock | M5 Communication | OpenAPI load → typed call path |
| `@jumentix/sdk-websocket-client` | L0–L1 | L3→L4 | B — mock | M5 Communication | Connect/subscribe junior path |
| `@jumentix/sdk-grpc-client` | L0 stub | L3→L4 | C — static | M5 Communication | Node-oriented; static only |
| `@jumentix/shared-contracts` | L0 stub | L3→L4 | C — static | M5 Communication | Spec resolution walkthrough |
| `@jumentix/persistence-contracts` | L0 stub | L3→L4 | C — static | M4 Persistence | Ports glossary + diagrams |
| `@jumentix/external-persistence-core` | L0 stub | L3→L4 | C — static | M4 Persistence | |
| `@jumentix/external-db-repositories` | L0 stub | L3→L4 | C — static | M4 Persistence | |
| `@jumentix/external-store-proxy` | L0 stub | L3→L4 | C — static | M4 Persistence | |
| `@jumentix/database-client-factory` | L0 stub | L3→L4 | C — static | M4 Persistence | |
| `@jumentix/adapter-runtime-bootstrap` | L0 stub | L3→L4 | C — static | M6 Adapters/runtime | Env → composition root |
| `@jumentix/runtime-infra` | L0 stub | L3→L4 | C — static | M6 Adapters/runtime | |
| `@jumentix/cli-init` | L0 stub | L3→L4 | C — static | M2 Getting started | First-success CLI journey |
| `@jumentix/config-ts` | L0 stub | L3→L4 | C — static | M7 Tooling | |
| `@jumentix/config-eslint` | L0 stub | L3→L4 | C — static | M7 Tooling | |
| `@jumentix/config-jest` | L0 stub | L3→L4 | C — static | M7 Tooling | Legacy naming callout |
| `@jumentix/agent-registry` | **Missing on site** | L3→L4 | C — static | M8 Governance packages | Add EN+pt-BR pages |
| `@jumentix/security-scanner` | **Missing on site** | L3→L4 | C — static | M8 Governance packages | Add EN+pt-BR pages |

**Counts:** 22 packages · ~5 with usage folders · 2 missing from website · ~15 single-page stubs needing zero→pleno rewrite.

---

## 6. Inventory — apps (3)

| App | Current depth | Target depth | Playground? | Owner milestone | Notes |
|-----|---------------|--------------|-------------|-----------------|-------|
| `apps/jumentix-website` | Meta docs in `documentation/` only | L3→L4 consumer “how the docs site works” | D / A (docs playground meta) | M9 Apps | Contributor + consumer paths; theme tokens |
| `apps/service-management` | Guides mention Domain Designer; no dedicated app hub | L3→L4 app tour | D — UI tour + Tier A playgrounds for designer-core/cana | M9 Apps | Zero→deploy journey for SM |
| `apps/backend-template` | Thin references via guides | L3→L4 scaffold journey | C — static + CLI | M9 Apps | Generate service → run → test |

**Counts:** 3 apps · 0 dedicated `/docs/.../apps/*` hubs today · all need junior hubs.

---

## 7. Published surfaces to extend (not replace)

| Area | Paths (EN) | Current | Target |
|------|------------|---------|--------|
| Concepts | `/docs/jumentix/concepts/*` | overview, architecture, getting-started | Deepen getting-started to L3; glossary hub |
| Guides | `/docs/jumentix/guides/*` | spa-pwa, rest-api, realtime-api, saas-* | Each guide = full numbered journey + verified playgrounds |
| Packages | `/docs/jumentix/packages/*` | mix of stubs + 5 usage folders | index + usage (or equivalent) at L3 for all 22 |
| Adapters | `/docs/jumentix/adapters/*` | databases/http/realtime indexes | Junior maps linking packages |
| Reference | `/docs/jumentix/reference/*` | errors, events, scripts, contracts, security | Keep as lookup; link from L2/L3 pages |
| Apps (new) | `/docs/jumentix/apps/*` | **absent** | One hub per app |
| SEO/AI | `public/llms.txt`, `llms-full.txt`, `docs-index.json`, JSON-LD | Generated | Regenerate after every content milestone |

Mirror all under `/docs/pt-BR/jumentix/...`.

---

## 8. Learning journeys (ordered)

1. **Orient** — concepts/overview → architecture glossary  
2. **First success** — concepts/getting-started → `cli-init` → backend-template hello  
3. **Offline / SPA** — guides/spa-pwa → designer-core → cana  
4. **Persistence** — persistence-contracts → KV/mutex → DB factory/repos  
5. **Communication** — shared-contracts → REST/WS/gRPC SDKs → message-mediator  
6. **Adapters / runtime** — adapter-runtime-bootstrap → runtime-infra → guide by topology  
7. **Apps** — service-management tour → website docs meta → backend-template full scaffold  
8. **Tooling / governance** — config-* → agent-registry → security-scanner  

Each milestone below must leave the reader able to continue without guessing terms.

---

## 9. Phased milestones + acceptance

### Verification bar (applies to every milestone)

A milestone is **Done** only when:

1. All touched pages exist in EN + pt-BR  
2. Template sections 1–9 present (no placeholders)  
3. Junior checklist (“I can …”) is honest and testable  
4. Static examples present; Tier A/B playground Run/Reset green locally  
5. Content smoke + relevant Cypress specs listed and green  
6. `scripts/generate-ai-surfaces.mjs` regenerated if routes changed  
7. Zero GitHub URLs in MDX body content  
8. Project Update in Linear records **exact** gate states (never claim pending as pass)

### M0 — Theme contrast + spa-pwa playground fix (bugs)

- Implement/verify contrast + designer-core snippet fixes  
- **DoD:** dark-mode home quote readable; spa-pwa designer-core Run returns `{ ok: true, ... }`; unit test for catalog API shape green  

### M1 — Getting started deepening

- Rewrite `concepts/getting-started` (+ pt-BR) to L3 with glossary + <30 min path  
- Link `cli-init` first-success  
- **DoD:** junior checklist passable without prior Jumentix knowledge; Cypress docs routes green  

### M2 — All delivery guides

- spa-pwa, rest-api, realtime-api, saas-monolith, saas-microservices → full template  
- Each guide: prerequisites → steps → playgrounds (where Tier allows) → errors → next  
- **DoD:** every guide L3; playgrounds green where A/B; EN/pt-BR parity  

### M3 — Browser / offline packages (cana, designer-core)

- Full surface maps + multi-snippet playgrounds  
- **DoD:** L4 evidence (Cypress playground smoke)  

### M4 — Persistence package tier

- All persistence-* / external-* / database-client-factory / key-value / mutex at L3  
- Playgrounds only where Tier A  
- **DoD:** inventory rows for these packages mark L3+ verified  

### M5 — Communication package tier

- SDKs + shared-contracts + message-mediator at L3  
- **DoD:** REST/WS playground green; gRPC static verified  

### M6 — Adapters + runtime packages

- adapter-runtime-bootstrap, runtime-infra + adapters IA pages  
- **DoD:** junior can pick HTTP/realtime/DB adapter path without jargon gaps  

### M7 — Tooling configs (NOT on public site)

- `config-ts`, `config-eslint`, `config-jest` remain **private** workspace packages  
- **DoD:** confirm they do **not** appear under `/docs/**/packages/config-*`, `llms.txt`, or packages hub  

### M8 — Governance packages (missing today)

- Add agent-registry + security-scanner site pages (EN+pt-BR)  
- **DoD:** packages index lists them; AI surfaces include them  

### M9 — Apps hubs

- `/docs/jumentix/apps/{jumentix-website,service-management,backend-template}` (+ pt-BR)  
- Zero→pleno per app  
- **DoD:** three hubs L3; linked from concepts and guides  

### M10 — SEO/AI + reference polish + epic docs issue

- Regenerate llms.txt / docs-index / JSON-LD  
- Reference pages cross-linked from package L3 pages  
- Epic documentation Issue completed per Requirement 094  
- **DoD:** AI surfaces list all new routes; epic Project Update final handoff  

---

## 10. File path map (implementation)

| Concern | Paths |
|---------|-------|
| Content EN | `content/jumentix/**` |
| Content pt-BR | `content/pt-BR/jumentix/**` |
| Playground | `components/docs-playground/**` |
| Theme tokens | `components/design-system/tokens.css`, `components/commercial/CommercialPages.module.css` |
| AI surfaces | `scripts/generate-ai-surfaces.mjs`, `public/llms.txt`, `public/docs-index.json` |
| Smoke | `scripts/content-smoke.mjs`, `cypress/e2e/docs-routes.cy.js` |
| This plan | `documentation/JUNIOR-DOCS-EXTENSION-PLAN.md` |

---

## 11. Resumo em português

Este plano exige documentação **do zero ao uso pleno**, com **aceitação verificada** por página:

- Começo absoluto → sucesso em menos de 30 min → fluxos centrais → cobertura da superfície pública necessária ao trabalho real  
- Checklist “Eu consigo …” + exemplos estáticos + playground verde (quando a Tier permitir) + evidência Cypress/smoke  
- EN e pt-BR em paridade; zero links de GitHub no corpo do conteúdo  
- 22 pacotes + 3 apps inventariados; a maioria ainda está em profundidade rasa (L0–L1)  
- Bugs já diagnosticados: contraste dark-mode na citação da home; playground designer-core no guia SPA/PWA usava formato inválido  

Marcos M0–M10 amarram bugs, jornadas, tiers de pacotes, apps e superfícies SEO/AI. Nada é “Done” sem a barra de verificação da seção 9.

---

## 12. Change log

| Date | Change |
|------|--------|
| 2026-08-11 | Initial plan; contrast + designer-core playground root causes; zero→pleno verified bar; inventories |
| 2026-08-11 | Private package fail-closed + consumer allowlist; responsibility-in-scope mandatory |

| 2026-08-11 | Epic completion pass: adapters/guides/apps template bar; private exclusion verified; Linear M1–M10 closed or canceled per policy |
