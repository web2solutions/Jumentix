# Spec Development Driven - Index

Jumentix now treats specifications as the primary engineering asset.  
Implementation is downstream of specification quality, traceability, and governance.

This documentation set defines how product intent, architecture constraints, contracts, quality gates, and delivery governance are transformed into executable work.

## Objective

- Make all delivery decisions spec-first.
- Consolidate all known project constraints into explicit specification resources.
- Ensure every code change is traceable to a governed spec artifact.

## Spec Development Driven Core Documents

1. [Spec Knowledge Source Map](./SPEC-KNOWLEDGE-SOURCE-MAP.md)
2. [Spec Lifecycle and Workflow](./SPEC-LIFECYCLE-AND-WORKFLOW.md)
3. [Spec Architecture and Coding Standards](./SPEC-ARCHITECTURE-CODING-STANDARDS.md)
4. [Spec Governance and Traceability](./SPEC-GOVERNANCE-AND-TRACEABILITY.md)
5. [Spec Templates and Checklists](./SPEC-TEMPLATES-AND-CHECKLISTS.md)
6. [Spec Canonical Coverage Matrix](./SPEC-CANONICAL-COVERAGE-MATRIX.md)
7. [Spec Canonical Knowledge Baseline](./SPEC-CANONICAL-KNOWLEDGE-BASELINE.md)
8. [Spec Features and Workflows Catalog](./SPEC-FEATURES-WORKFLOWS-CATALOG.md)
9. [Spec Requirements Traceability Ledger](./SPEC-REQUIREMENTS-TRACEABILITY-LEDGER.md)
10. [Spec Delivery Gates and Evidence](./SPEC-DELIVERY-GATES-AND-EVIDENCE.md)
11. [Spec Operating Model by Component](./SPEC-OPERATING-MODEL-BY-COMPONENT.md)
12. [Spec Project Board Contract](./SPEC-PROJECT-BOARD-CONTRACT.md)

## Mandatory Principle

No feature, bugfix, refactor, adapter, contract, or runtime change is considered complete unless:

1. The change is represented in spec artifacts.
2. The spec artifacts are linked to governance records (Issue + Project item + PR).
3. Quality, coverage, and architecture checks prove spec conformance.

## Full Knowledge Coverage Policy

Spec Development Driven in Jumentix covers all known information sources:

1. Product intention and positioning
2. Features and workflows
3. Architecture principles and design constraints
4. Contracts (HTTP, realtime, event, error, port objects)
5. Runtime and deployment behavior
6. Security, quality, and compliance policies
7. Project governance and delivery traceability

This policy is enforced through:

1. canonical source mapping
2. requirement and NFR ledgers
3. executable CI/coverage/security gates
4. project management traceability (Issue -> Project -> PR -> evidence)

## Binding Sources

Spec-Driven execution depends on and reuses these existing sources:

- OpenAPI and AsyncAPI contracts (`/spec`)
- Runtime and architecture docs (`documentation/md`)
- Agents requirements registry (`.agents/requirements`)
- NFR registry (`.agents/NFR-REGISTRY.md`)
- Project governance rules (`documentation/md/JUMENTIX-PROJECT-GOVERNANCE.md`)
- GitHub Project Jumentix board (`https://github.com/users/web2solutions/projects/1`)
