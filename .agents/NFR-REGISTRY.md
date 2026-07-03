# Jumentix NFR Registry

This file consolidates non-functional requirements already requested and stored in `.agents/requirements`.

## Architecture and Design NFRs

- `015` DDD + Event-Driven + Hexagonal architecture baseline.
- `016` Layer call order and boundaries.
- `017` Event-first integration and circular reference avoidance.
- `036` OpenAPI port object contract requirements.
- `050` Generic adapters must become distributable packages.

## Quality, Coverage, and CI NFRs

- `011` Minimal CI gate baseline.
- `014` Codecov coverage integrity.
- `020` Coverage threshold as approval gate.
- `063` Workspace coverage policy governance.
- `065` Commit/push integrity with real CI checks.

## Security and Compliance NFRs

- `044` PCI-oriented security hardening.
- `029` Multi-tenancy and RBAC foundation.
- `067` Bidirectional task/PR traceability governance (auditability).

## Runtime and Operations NFRs

- `001` Node 22 runtime standard.
- `041` PM2 VM orchestration.
- `042` Env-driven runtime adapter selection.
- `043` Runtime env docs + governance.

## Documentation and Governance NFRs

- `018` Project docs and structure sync.
- `025` Every new feature must be documented.
- `053` Workspace package docs and ownership.
- `056`/`064` GitHub project as single source of truth.
- `057` PR grouping by priority.
- `066` Documentation round governance for marketing root + technical component docs.
- `068` NFR capture and registry governance.
- `069` Website commercial/static/vercel governance.
- `070` npm organization and vercel scope integration governance.

## Rule of Use

When a new NFR is requested:

1. add/update requirement file in `.agents/requirements/`
2. update `.agents/README.md` index
3. update this registry mapping
