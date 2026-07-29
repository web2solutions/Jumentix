# Spec Requirements Traceability Ledger

<!-- requirements-inventory: files=106 unique=103 mapped=103 duplicates=055,060,079 -->

This ledger maps requirement IDs to spec resources and validation evidence expectations.

It is the canonical bridge between `.agents/requirements` and implementation workflows.

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

- `008`, `010`, `021`, `026`, `027`, `028`, `036`, `047`
- Spec resources:
  - `spec/1.0.0.yml`
  - `spec/asyncapi/1.0.0.websocket.yml`
  - `spec/asyncapi/1.0.0.grpc.yml`
  - `documentation/md/EVENTS-AND-MESSAGES-MAP.md`
  - `documentation/md/contracts/*`
- Evidence:
  - route/channel resolution checks
  - realtime integration/smoke tests

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

- `015`, `016`, `017`, `034`, `048`, `049`, `053`, `058`, `059`, `060` (both entries), `062`
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

- `011`, `014`, `020`, `044`, `063`, `065`, `074`, `087`, `088`
- Spec resources:
  - `documentation/md/TESTING-CI-AND-QUALITY.md`
  - `documentation/md/SECURITY-RUNBOOK-PCI.md`
  - `documentation/md/PCI-REMEDIATION-PLAN-AND-EVIDENCE.md`
  - coverage/check scripts in `ci-cd/*`
- Evidence:
  - destination-appropriate CI gate green
  - coverage threshold proof
  - security/compliance check results

## G. Documentation, Governance Process, and Multi-Agent Operations

- `009`, `018`, `019`, `023`, `024`, `025`, `033`, `035`, `056`, `057`, `064`, `066`, `067`, `068`, `071`, `072`, `073`, `075`, `076`, `077`, `078`, `079`, `080`, `081`, `082`, `083`, `084`, `085`, `086`, `087`, `088`, `089`, `090`, `094`, `095`, `097`, `098`, `099`, `100`, `101`, `102`, `103`
- Spec resources:
  - `documentation/README.md`
  - `documentation/md/JUMENTIX-PROJECT-GOVERNANCE.md`
  - `documentation/md/PROJECT-MANAGEMENT.md`
  - `.agents/README.md`
  - `.agents/NFR-REGISTRY.md`
  - `.agents/AGENT-REGISTRY.md`
  - `AGENTS.md`
  - `CLAUDE.md`
  - `GROK.md`
- Evidence:
  - docs index links updated
  - requirements registry synchronized
  - `pnpm run requirements:check` passes
  - agent instruction parity (Codex, Claude Code, Grok)
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

- `037`, `038`, `054`, `055` (both entries), `069`, `070`, `091`, `092`, `093`
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

As of `2026-07-29`, this ledger covers all unique requirement IDs currently registered in `.agents/requirements`:

1. Requirement files in the registry: `106`
2. Unique IDs in requirements registry: `103`
3. Unique IDs mapped in this ledger: `103`
4. Duplicate IDs with independently binding files: `055`, `060`, `079`
5. Missing IDs: `none`
