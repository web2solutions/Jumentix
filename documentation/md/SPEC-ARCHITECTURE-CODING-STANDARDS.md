# Spec Architecture and Coding Standards

This document binds Spec Development Driven execution to Jumentix architecture and engineering standards.

## Architecture Principles (Non-negotiable)

1. Domain Driven Design
2. Event Driven Design
3. Hexagonal Architecture
4. Feature-driven delivery with minimal layer spread
5. Contract-first interfaces (OpenAPI/AsyncAPI + message contracts)

## Layer Model

Required flow:

`Handler -> Controller -> Application Use Case -> Domain -> Repository Port -> Adapter`

Prohibited patterns:

- Controller directly orchestrating infra
- Adapter-specific logic leaking into domain/application core
- Circular imports across core modules

## Domain and Data Standards

1. Domain models enforce invariants.
2. Value objects are explicit and validated.
3. Data entities keep required lifecycle fields (`createdAt`, `updatedAt`) where mandated.
4. Model behavior must remain aligned with OpenAPI 3.1 constraints for types, formats, and validations.

## Contract Standards

1. Every endpoint operation must resolve to a real handler + controller method.
2. Port objects for input/output must be described in OpenAPI contracts.
3. Realtime channels/events must align with AsyncAPI contracts and runtime handlers.
4. Event and error contracts must be documented and traceable.

## Runtime and Adapter Standards

1. Runtime adapter selection is environment-driven.
2. Each interface implementation must use native runtime semantics for its framework/protocol.
3. Shared/generic adapters should evolve into distributable workspace packages.
4. PM2 process orchestration policy applies for VM-style environments.

## Security and Compliance Standards

1. Tenant scope and RBAC enforcement are domain/application responsibilities.
2. Sensitive fields must not leak beyond service boundaries.
3. Error exposure policy:
   - detailed in dev/staging
   - masked in production
4. Security gates and compliance smoke tests are mandatory in CI.

## Coding Standards

1. Preserve existing codebase patterns before introducing new abstractions.
2. Prefer structured APIs/parsers over ad-hoc string parsing.
3. Keep refactors scoped to requested behavior and related boundaries.
4. Match test depth to risk:
   - narrow change -> focused tests
   - shared/cross-module change -> broader test coverage

## Documentation Standards

1. Every feature/change must include docs updates.
2. Any contract or behavior change must update relevant spec files.
3. NFR-impacting changes must update `.agents/requirements` and NFR registry.
4. Documentation must include enough operational detail for engineering reuse.

