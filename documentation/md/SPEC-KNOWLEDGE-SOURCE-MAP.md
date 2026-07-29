# Spec Knowledge Source Map

This map defines where specification truth lives and how sources are prioritized.

## Source Priority

Linear is the sole authority for task, epic, milestone, and planning metadata. The order below
governs software contracts and versioned specification content; it never overrides current Linear
planning state.

When conflicts happen, resolution order is:

1. Versioned contract specs (`spec/1.0.0.yml`, `spec/asyncapi/*`)
2. Governance requirements (`.agents/requirements/*`, `.agents/NFR-REGISTRY.md`)
3. Project governance (`documentation/md/JUMENTIX-PROJECT-GOVERNANCE.md`)
4. CI/CD executable gates (`ci-cd/*`, husky hooks, coverage policy)
5. Technical architecture docs (`documentation/md/*`)
6. Product/commercial positioning docs (`README.md`, website content)

## Authoritative Sources by Domain

## Product Intention and Delivery Scope

- Root positioning: `README.md`
- Project overview: `documentation/md/PROJECT-OVERVIEW.md`
- Product composition system: `documentation/md/SPEC-JUMENTIX-COMPONENT-SYSTEM.md`
- Planning Projects, Issues, milestones, and Project Updates: `https://linear.app/jumentix`
- GitHub branches, commits, PRs, and checks: delivery evidence only

## Architecture and Design

- `documentation/md/ARCHITECTURE-AND-STRUCTURE.md`
- `documentation/md/HEXAGONAL-FEATURE-DRIVEN-MIGRATION.md`
- `.agents/requirements/015-architecture-nfr-ddd-eda-hexagonal.md`
- `.agents/requirements/016-layer-call-order-and-boundaries.md`
- `.agents/requirements/017-event-first-integration-and-circular-safety.md`

## Contracts and Interfaces

- REST/OpenAPI: `spec/1.0.0.yml`
- Realtime/AsyncAPI: `spec/asyncapi/1.0.0.websocket.yml`, `spec/asyncapi/1.0.0.grpc.yml`
- Event/message map: `documentation/md/EVENTS-AND-MESSAGES-MAP.md`
- Error contracts: `documentation/md/ERROR-CONTRACTS-AND-RESPONSES.md`
- Port object requirement: `.agents/requirements/036-openapi-port-objects-contracts.md`

## Runtime and Deployment

- Runtime env contracts: `documentation/md/RUNTIME-ENVIRONMENT-CONTRACTS.md`
- Setup and API runtime: `documentation/md/SETUP-RUNTIME-AND-API.md`
- PM2 orchestration requirement: `.agents/requirements/041-pm2-vm-runtime-orchestration.md`
- Env-driven adapter selection: `.agents/requirements/042-env-driven-runtime-adapter-selection.md`

## Data, Domain, and Persistence

- Domain entities documentation: `documentation/md/DOMAIN-DATA-ENTITIES.md`
- Users domain docs under `documentation/md/domains/users/*`
- External data adapters: `documentation/md/EXTERNAL-DATA-ADAPTER-FOUNDATIONS.md`
- Database smoke validation: `documentation/md/DATABASE-DRIVERS-SMOKE-TESTS.md`

## Quality, Security, and Compliance

- CI and quality: `documentation/md/TESTING-CI-AND-QUALITY.md`
- CI troubleshooting: `documentation/md/CI-TROUBLESHOOTING.md`
- PCI runbook: `documentation/md/SECURITY-RUNBOOK-PCI.md`
- PCI remediation plan: `documentation/md/PCI-REMEDIATION-PLAN-AND-EVIDENCE.md`
- Security/compliance spec contract: `documentation/md/SPEC-SECURITY-AND-COMPLIANCE-PRACTICES.md`
- Security hardening requirement: `.agents/requirements/044-pci-security-compliance-hardening.md`

## Governance and Process

- Project governance: `documentation/md/JUMENTIX-PROJECT-GOVERNANCE.md`
- Project management bridge: `documentation/md/PROJECT-MANAGEMENT.md`
- Project board contract: `documentation/md/SPEC-PROJECT-BOARD-CONTRACT.md`
- Engineering practices + git policy: `documentation/md/SPEC-ENGINEERING-PRACTICES-AND-GIT-POLICY.md`
- NFR capture policy: `.agents/requirements/068-nfr-capture-and-registry-governance.md`
- Commit/push integrity: `.agents/requirements/065-commit-push-integrity-and-real-ci-enforcement.md`

## Source Update Triggers

Any change in the following requires spec updates:

1. Domain/entity/model/value object change
2. API endpoint/operation/event/message change
3. Error contract/response schema change
4. Runtime/deployment variable, adapter, or startup flow change
5. Security/compliance behavior change
6. Governance rule change

## Required Synchronization Targets

When any trigger occurs, update at least:

- Corresponding spec file(s) in `/spec`
- Matching docs under `documentation/md`
- Relevant requirement file under `.agents/requirements`
- NFR registry and agent index when non-functional behavior is affected

## Canonical Spec-Driven Consolidation Resources

The following documents consolidate cross-source knowledge and must be updated whenever global understanding changes:

1. `SPEC-CANONICAL-KNOWLEDGE-BASELINE.md`
2. `SPEC-FEATURES-WORKFLOWS-CATALOG.md`
3. `SPEC-REQUIREMENTS-TRACEABILITY-LEDGER.md`
4. `SPEC-DELIVERY-GATES-AND-EVIDENCE.md`
5. `SPEC-OPERATING-MODEL-BY-COMPONENT.md`
6. `SPEC-PROJECT-BOARD-CONTRACT.md`
7. `SPEC-ENGINEERING-PRACTICES-AND-GIT-POLICY.md`
8. `SPEC-SECURITY-AND-COMPLIANCE-PRACTICES.md`
9. `SPEC-JUMENTIX-COMPONENT-SYSTEM.md`
