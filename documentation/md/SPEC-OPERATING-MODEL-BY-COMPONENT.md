# Spec Operating Model by Component

This document defines how each Jumentix component participates in Spec Development Driven execution.

## Monorepo Root

Responsibilities:

1. Provide canonical index (`README.md`, `documentation/README.md`).
2. Define governance rules and quality policies.
3. Run monorepo-level CI orchestration and release checks.

Spec obligations:

1. Keep global workflow/governance docs current.
2. Keep root policies aligned with workspace scripts and CI.

## `apps/backend-template`

Responsibilities:

1. Backend architecture reference implementation.
2. Domain/use-case/controller/adapter implementation.
3. OpenAPI/AsyncAPI contract serving and validation.

Spec obligations:

1. Update `spec/1.0.0.yml` and AsyncAPI specs for interface changes.
2. Update domain/entity/value-object docs for data behavior changes.
3. Update adapter docs for runtime/protocol changes.

## `apps/service-management`

Responsibilities:

1. UX for service and domain design workflows.
2. Environment/runtime configuration flows.
3. Deployment profile configuration support.

Spec obligations:

1. Keep workflow docs synchronized with real UI capabilities.
2. Keep service configuration contracts explicit and testable.

## `apps/jumentix-website`

Responsibilities:

1. Commercial positioning and product communication.
2. Documentation discoverability and conversion funnel.

Spec obligations:

1. Keep product claims aligned with technical capability docs.
2. Ensure links and feature statements are traceable to canonical technical specs.

## `packages/*`

Responsibilities:

1. Shared reusable contracts/adapters/runtime tools.
2. Cross-service interoperability foundations.

Spec obligations:

1. Keep package README and API contracts synchronized with exported behavior.
2. Maintain explicit ownership and compatibility statements.
3. Keep tests and release metadata aligned with declared contracts.

## `.agents/*`

Responsibilities:

1. Requirement and NFR registry.
2. Governance memory and decision constraints.

Spec obligations:

1. Capture every user-requested NFR/governance rule as requirement artifact.
2. Keep indexes and registry synchronized.

## GitHub Project and Issues

Responsibilities:

1. Execution planning and status lifecycle.
2. Priority, estimate, and iteration governance.
3. Traceability between tasks and PRs.

Spec obligations:

1. Every implementation maps to issue/project context.
2. PR includes task mapping and evidence links.

## Sync Contract

A component change is compliant only when:

1. Component-local docs are updated.
2. Shared canonical docs are updated when cross-component behavior changes.
3. Requirement registry is updated when non-functional constraints change.
