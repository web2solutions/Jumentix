# Spec Requirements Traceability Ledger

<!-- requirements-inventory: files=136 unique=136 mapped=136 duplicates= -->

This ledger maps requirement IDs to spec resources and validation evidence expectations.

It is the canonical bridge between `.agents/requirements/project/`, `.agents/requirements/software/`, and implementation workflows.

## How to Use

For any change, identify impacted requirement IDs and ensure:

1. Matching spec/doc files are updated.
2. Matching tests/checks are executed.
3. PR references the requirement IDs and evidence.

## Requirement Groups

## A. Build, Runtime, and Dependency Integrity

- `001`, `002`, `012`, `013`, `041`, `042`, `043`, `052`, `096`
- Spec resources:
  - `documentation/md/RUNTIME-ENVIRONMENT-CONTRACTS.md`
  - `documentation/md/SETUP-RUNTIME-AND-API.md`
  - `pm2/*`
  - runtime adapter docs under `documentation/md/adapters/http/*`
- Evidence:
  - runtime bootstrap tests
  - CI startup/build checks

## B. Core Service and Domain Correctness

- `003`, `004`, `005`, `006`, `007`, `022`, `029`, `031`, `032`, `045`, `061`
- Spec resources:
  - `spec/1.0.0.yml`
  - `documentation/md/DOMAIN-DATA-ENTITIES.md`
  - `documentation/md/domains/users/*`
  - `documentation/md/ERROR-CONTRACTS-AND-RESPONSES.md`
- Evidence:
  - unit tests for services/models/controllers
  - integration tests for endpoint behavior

## C. Contract and Interface Conformance

- `008`, `010`, `021`, `026`, `027`, `028`, `036`, `047`, `136`
- Spec resources:
  - `spec/1.0.0.yml`
  - `spec/asyncapi/1.0.0.websocket.yml`
  - `spec/asyncapi/1.0.0.grpc.yml`
  - `documentation/md/EVENTS-AND-MESSAGES-MAP.md`
  - `documentation/md/contracts/*`
  - `apps/frontend/*` (consumes only the OAS surface and generated SDKs)
- Evidence:
  - route/channel resolution checks
  - realtime integration/smoke tests
  - workspace boundary checks with the frontend workspace present

## D. Data Adapter and Persistence Interoperability

- `030`, `039`, `040`, `046`, `050`, `051`
- Spec resources:
  - `documentation/md/EXTERNAL-DATA-ADAPTER-FOUNDATIONS.md`
  - `documentation/md/adapters/databases/*`
  - `documentation/md/DATABASE-DRIVERS-SMOKE-TESTS.md`
  - `packages/persistence-contracts/*`
- Evidence:
  - database smoke tests by driver
  - adapter bootstrap tests

## E. Architecture and Design Governance

- `015`, `016`, `017`, `034`, `048`, `049`, `053`, `058`, `059`, `060`, `062`, `121`
- Spec resources:
  - `documentation/md/ARCHITECTURE-AND-STRUCTURE.md`
  - `documentation/md/HEXAGONAL-FEATURE-DRIVEN-MIGRATION.md`
  - `documentation/md/JUMENTIX-MONOREPO-EXECUTION-PLAN.md`
  - `documentation/md/JUMENTIX-MIGRATION-INVENTORY-AND-ROLLBACK.md`
- Evidence:
  - boundary checks
  - import cycle checks
  - workspace checks

## F. Quality, Security, and Compliance Gates

- `011`, `014`, `020`, `044`, `063`, `065`, `074`, `087`, `088`, `104`, `105`, `106`, `107`, `108`, `109`, `110`, `111`, `112`, `113`, `115`, `118`
- Spec resources:
  - `documentation/md/TESTING-CI-AND-QUALITY.md`
  - `documentation/md/HEXAGONAL-TEST-PYRAMID.md`
  - `documentation/md/SECURITY-RUNBOOK-PCI.md`
  - `documentation/md/PCI-REMEDIATION-PLAN-AND-EVIDENCE.md`
  - `documentation/md/CANONICAL-INTEGRATIONS-AND-PROVIDER-REBINDING.md`
  - coverage/check scripts in `ci-cd/*`
- Evidence:
  - destination-appropriate CI gate green
  - coverage threshold proof
  - security/compliance check results
  - `bun run integrations:check` and terminal provider-side evidence

## G. Documentation, Governance Process, and Multi-Agent Operations

- `009`, `018`, `019`, `023`, `024`, `025`, `033`, `035`, `056`, `057`, `064`, `066`, `067`, `068`, `071`, `072`, `073`, `075`, `076`, `077`, `078`, `079`, `080`, `081`, `082`, `083`, `084`, `085`, `086`, `087`, `088`, `089`, `090`, `094`, `095`, `097`, `098`, `099`, `100`, `101`, `102`, `103`, `104`, `105`, `106`, `107`, `108`, `109`, `110`, `111`, `112`, `113`, `114`, `116`, `117`, `119`, `120`, `121`, `122`, `124`, `125`, `126`, `127`, `128`, `129`, `130`, `131`, `132`, `133`, `134`, `135`
- Spec resources:
  - `documentation/README.md`
  - `documentation/md/JUMENTIX-PROJECT-GOVERNANCE.md`
  - `documentation/md/PROJECT-MANAGEMENT.md`
  - `documentation/md/CANONICAL-REPOSITORY-MIGRATION.md`
  - `INTEGRATION-MIGRATION-REQUIREMENT.md`
  - `.agents/README.md`
  - `.agents/NFR-REGISTRY.md`
  - `.agents/AGENT-REGISTRY.md`
  - `.agents/supported-agents.json`
  - `AGENTS.md`
  - `CLAUDE.md`
  - `GROK.md`
  - `KIMI.md`
- Evidence:
  - docs index links updated
  - requirements registry synchronized
  - `bun run requirements:check` passes
  - agent instruction parity (Codex, Claude Code, Grok, OpenCode, Kimi Code CLI)
  - agent registration and availability assignment records
  - milestone association, focused epic parentage, nature grouping, and epic-level delegation
    records
  - `main` and `dev` branch pre-work check records
  - project/PR traceability present
  - task PRs target `dev`, and only release promotions sourced from `dev` target `main`
  - completed Linear epic Project linked to its completed dedicated documentation Issue and evidence
  - task-specific Linear Project Updates from start through final handoff, with agent, delivery,
    exact gate, blocker/risk, and next-action evidence

## H. Productization and Platform Expansion

- `037`, `038`, `054`, `055`, `069`, `070`, `091`, `092`, `093`, `123`, `125`, `126`
- Spec resources:
  - `packages/cli-init/*`
  - `apps/service-management/documentation/*`
  - `documentation/md/SDK-COMPATIBILITY-BRIDGE.md`
  - website docs and deployment flows
- Evidence:
  - package/app tests
  - deployment script validation
  - docs + governance sync

## Governance Binding

This ledger is mandatory in PR planning for medium/high-impact changes.  
If impacted requirement IDs are not mapped before implementation, the change is non-compliant with Spec Development Driven.

## Coverage Attestation (Current Baseline)

As of `2026-08-05`, this ledger covers all unique requirement IDs currently registered in `.agents/requirements/project/` and `.agents/requirements/software/`:

1. Requirement files in the registry: `126`
2. Unique requirement IDs in the registry: `126`
3. Unique IDs mapped in this ledger: `126`
4. Duplicate IDs with independently binding files: `none`
5. Missing IDs: `none`

### `105` Hexagonal Test Pyramid / layer-aware gates
- Specs: `documentation/md/HEXAGONAL-TEST-PYRAMID.md`, `.agents/requirements/software/105-hexagonal-test-pyramid-layer-aware-gates.md`
- Evidence: `test-map.json`, `ci-cd/check-test-map.js`, `ci-cd/lib/layer-resolver.js`, `ci-cd/run-task-change-tests.js`, `ci-cd/run-unit-tests.js`

### `114`–`121` Agent operating pack (JUM-595 + 2026-08-02 owner additions)
- Specs: `documentation/md/AGENT-OPERATING-REQUIREMENTS-114-121.md` (+ pt-BR)
- Requirements: `.agents/requirements/project/114-*.md` … `121-*.md`
- Evidence: `bun run requirements:check`; agent instruction parity in `AGENTS.md` / `CLAUDE.md` / `GROK.md`; Docker-backed smoke/integration scripts for `118`; API-first / `gh` orchestration for `119`; Linear agent-assignment visibility for `120`; cross-agent coordination evidence for `121`

### `129` Mandatory Firebase RTDB agent progress bus
- Specs: `.agents/requirements/project/129-mandatory-firebase-agent-bus.md`, `documentation/md/AGENT-OPERATING-REQUIREMENTS-114-121.md` (+ pt-BR), `documentation/md/AGENT-RTK-AND-CAVEMAN-GUIDE.md` (+ pt-BR)
- Evidence: `packages/agent-registry/src/rtdb-client.ts`, `packages/agent-registry/src/bus-commands.ts`, `ci-cd/agent-registry-cli.js`, `bun run agent-bus:publish|watch|status`, package unit tests with mocked RTDB

### `126` Service Management ownership and public contracts (JUM-465)
- Specs: `.agents/requirements/software/126-service-management-ownership-and-public-contracts.md`, `documentation/md/RUNTIME-ENVIRONMENT-CONTRACTS.md`, `documentation/md/SERVICE-MANAGEMENT-APPLICATION.md`, `.agents/COMPONENT-OWNERSHIP.md`
- Evidence: `bun run requirements:check`; `bun run test-map:check`; integration smoke asserting the pinned contracts (`JUM-466`)

### `125` Agent support declaration (JUM-604)
- Specs: `documentation/md/AGENT-SUPPORT-DECLARATION.md` (+ pt-BR)
- Requirements: `.agents/requirements/project/125-agent-support-declaration.md`
- Evidence: `.agents/supported-agents.json`; `ci-cd/check-pr-governance.js` deriving task-branch prefixes from the declaration and verifying each declared instructions file; `KIMI.md`; `bun run pr:governance:check`; `bun run requirements:check`
