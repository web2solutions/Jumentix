# Spec Canonical Knowledge Baseline

This document defines the full knowledge baseline that Spec Development Driven must capture for Jumentix.

Every implementation, release, and governance decision must be representable through spec artifacts that map to this baseline.

## Baseline Goal

Jumentix must never depend on implicit team memory for critical behavior.  
All known intent must be explicit, versioned, and traceable.

## Canonical Knowledge Families

1. Product intention and value proposition
   - Sources:
     - `README.md`
     - `apps/jumentix-website/*`
2. Architecture principles and design constraints
   - Sources:
     - `documentation/md/ARCHITECTURE-AND-STRUCTURE.md`
     - `documentation/md/HEXAGONAL-FEATURE-DRIVEN-MIGRATION.md`
     - `.agents/requirements/015-architecture-nfr-ddd-eda-hexagonal.md`
     - `.agents/requirements/016-layer-call-order-and-boundaries.md`
     - `.agents/requirements/017-event-first-integration-and-circular-safety.md`
3. Domain and data model contracts
   - Sources:
     - `documentation/md/DOMAIN-DATA-ENTITIES.md`
     - `documentation/md/domains/users/*`
     - `.agents/requirements/019-domain-data-entity-documentation-standard.md`
     - `.agents/requirements/026-openapi31-data-entity-model-compliance.md`
     - `.agents/requirements/032-entity-timestamps-domain-object-methods-and-oas-sync.md`
4. Interface and communication contracts
   - Sources:
     - `spec/1.0.0.yml`
     - `spec/asyncapi/1.0.0.websocket.yml`
     - `spec/asyncapi/1.0.0.grpc.yml`
     - `documentation/md/EVENTS-AND-MESSAGES-MAP.md`
     - `documentation/md/ERROR-CONTRACTS-AND-RESPONSES.md`
5. Runtime, infra, deployment, and operations contracts
   - Sources:
     - `documentation/md/RUNTIME-ENVIRONMENT-CONTRACTS.md`
     - `documentation/md/SETUP-RUNTIME-AND-API.md`
     - `documentation/md/JUMENTIX-DEPLOY-TARGET-AND-PACKAGING-MATRIX.md`
     - `pm2/*`
6. Quality, security, and compliance rules
   - Sources:
     - `documentation/md/TESTING-CI-AND-QUALITY.md`
     - `documentation/md/SECURITY-RUNBOOK-PCI.md`
     - `documentation/md/PCI-REMEDIATION-PLAN-AND-EVIDENCE.md`
     - `ci-cd/*`
7. Project governance and execution model
   - Sources:
     - `documentation/md/JUMENTIX-PROJECT-GOVERNANCE.md`
     - `documentation/md/PROJECT-MANAGEMENT.md`
     - `.agents/requirements/*`
     - `.agents/NFR-REGISTRY.md`
      - Linear Project: `https://linear.app/jumentix`

## Spec Coverage Rule

For each knowledge family above, Jumentix must maintain:

1. Spec artifact(s) that define behavior or policy.
2. Enforcement mechanism(s) in CI, tests, checks, or workflow policy.
3. Traceability links to issue, project item, PR, and changed files.

## No-Unknown-State Policy

A delivery is incomplete when any changed behavior is not represented in at least one of:

1. OpenAPI/AsyncAPI/message/error contract docs.
2. Domain/entity/model/value-object docs.
3. Runtime/deployment/env contracts.
4. Requirement/NFR governance registry.
5. Validation evidence (tests/checks/coverage/security gates).

## Synchronization Targets (Mandatory)

When knowledge changes, update in the same cycle:

1. `spec/*` contract resources (when interfaces/messages change).
2. `documentation/md/*` technical resources.
3. `.agents/requirements/*` when constraints or governance are affected.
4. `.agents/NFR-REGISTRY.md` when non-functional behavior changes.
5. Linear issue/project metadata and PR evidence links.
