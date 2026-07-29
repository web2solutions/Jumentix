# Spec Jumentix Component System

This specification defines Jumentix as a composed product system made of libraries, tools, templates, and components.

It is the canonical reference for product composition, ownership boundaries, and evolution rules.

## 1) Product Composition Model

Jumentix is composed of four first-class asset types:

1. Libraries
2. Tools
3. Templates
4. Components (applications/services)

Any new asset in the monorepo must be classified into one of these types.

## 2) Libraries (Reusable Runtime Assets)

Primary location: `packages/*`

Examples:

1. Message mediation
2. Persistence contracts
3. Runtime infra/bootstrap
4. Key-value, mutex, SDK clients
5. Shared config packages

Rules:

1. Libraries must expose clear API contracts.
2. Libraries must include technical docs and ownership boundaries.
3. Generic reusable adapters should live as packages, not duplicated in apps.

## 3) Tools (Delivery and Governance Assets)

Primary locations:

1. `ci-cd/*`
2. `.husky/*`
3. project governance scripts and quality gates

Examples:

1. CI orchestrators
2. coverage/security/governance checks
3. changelog and release automation

Rules:

1. Tools must have explicit enforcement intent.
2. Tool outputs must be auditable and reproducible.
3. Tooling behavior changes must be documented in specs.

## 4) Templates (Scaffolding and Bootstrap Assets)

Primary locations:

1. `apps/backend-template/*`
2. `packages/cli-init/*`
3. template-oriented docs and bootstrap contracts

Rules:

1. Templates must define what is scaffolded and why.
2. Template outputs must preserve architecture and governance policies.
3. Template/runtime contract drift must be blocked by docs+checks.

## 5) Components (Runnable Product Units)

Primary locations:

1. `apps/backend-template`
2. `apps/service-management`
3. `apps/jumentix-website`

Rules:

1. Each component must have technical documentation and boundaries.
2. Components consume libraries via package contracts.
3. Component behavior must map to spec artifacts and quality gates.

## 6) Cross-Type Contracts

1. Libraries are imported by components/tools/templates through explicit package contracts.
2. Tools enforce quality and governance over all asset types.
3. Templates bootstrap component structures and configure library usage.
4. Specs must state ownership and integration expectations across types.

## 7) Spec-Driven Governance Requirements

For any change affecting composition:

1. update composition docs/specs
2. update requirement/NFR registries if governance impact exists
3. update indexes and source maps
4. include traceability evidence in the Linear Issue/Project/Project Update and GitHub PR

## 8) Primary References

1. `documentation/md/JUMENTIX-WORKSPACE-PACKAGES.md`
2. `documentation/md/PROJECT-OVERVIEW.md`
3. `documentation/md/ARCHITECTURE-AND-STRUCTURE.md`
4. `documentation/md/SPEC-OPERATING-MODEL-BY-COMPONENT.md`
5. `documentation/md/SPEC-REQUIREMENTS-TRACEABILITY-LEDGER.md`
