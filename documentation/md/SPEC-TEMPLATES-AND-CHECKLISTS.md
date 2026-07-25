# Spec Templates and Checklists

Use these templates for all spec-first changes.

## Template A - Feature Spec

```md
# Feature Spec - <title>

## Context
- Business objective:
- User impact:
- Scope:

## Contracts
- OpenAPI operations affected:
- AsyncAPI channels/events affected:
- Message/Event contracts affected:
- Error contracts affected:

## Architecture Impact
- Domains:
- Use cases:
- Ports/adapters:
- Boundary risks:

## Data Impact
- Entities/models/value objects changed:
- Validation/type/format updates:
- Migration/compatibility notes:

## Runtime/Deployment Impact
- Env vars:
- PM2/runtime changes:
- Cloud/deploy implications:

## Security and Compliance
- RBAC/tenant scope impact:
- Secret/sensitive data handling:
- Error exposure behavior:

## Test Strategy
- Unit:
- Integration:
- Smoke:
- Coverage target confirmation:

## Governance
- Issue:
- Project item:
- Priority/Estimate:
- Acceptance criteria:
```

## Template B - Contract Change Spec

```md
# Contract Change Spec - <title>

## Contract Type
- OpenAPI / AsyncAPI / Message Contract / Error Contract

## Previous Behavior
- ...

## New Behavior
- ...

## Compatibility
- Backward compatible? yes/no
- Consumer impact:
- SDK impact:

## Validation
- Route/channel resolution evidence:
- Contract test evidence:
```

## Template C - NFR / Governance Spec

```md
# NFR Spec - <title>

## NFR Category
- performance / security / compliance / reliability / governance / operability

## Requirement Statement
- ...

## Enforcement
- CI/CD checks:
- Runtime controls:
- Process controls:

## Evidence
- Metrics/logs/tests:
- Required docs updates:
- Required registry updates:
```

## Delivery Checklist (Mandatory)

Before PR:

1. Issue exists and is linked to project item.
2. Project fields are complete.
3. Spec files updated for all changed contracts/behaviors.
4. Architecture and boundary impact reviewed.
5. Tests implemented per risk profile.
6. Coverage thresholds satisfied.
7. Documentation updated (including index links).
8. `.agents` requirement/NFR files updated when applicable.
9. PR description includes traceability and evidence.

Before merge:

1. CI gates green.
2. Patch coverage gate green.
3. Security/compliance checks green.
4. Project item moved to `Done` with evidence references.

