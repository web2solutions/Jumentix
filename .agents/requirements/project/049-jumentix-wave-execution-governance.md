# Requirement 049 - Jumentix Delivery Governance

## Requirement

Changes that affect multiple apps or packages must use a bounded Linear task
with explicit scope, acceptance criteria, rollback approach, and required
quality gates. The current monorepo layout is the implemented `apps/*` and
`packages/*` tree; completed migration-wave plans are historical only.

## Acceptance Criteria

- Linear records the task, sequencing, and delivery evidence.
- Each change advances only after its destination-appropriate build, test,
  coverage, security, and documentation gates pass.
- Documentation describes the current architecture and rollback path, not a
  completed migration checklist.
- A PR does not mix unrelated delivery scopes without a documented dependency.

