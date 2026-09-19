# Requirement 062 - Workspace Dependency Boundaries Governance

## Status
Implemented

## Scope
- Enforce import boundaries between monorepo `apps/*` and `packages/*`.
- Prevent accidental coupling to deprecated `sdk-clients/*`.
- Keep temporary bridge exceptions explicit, auditable, and minimal.

## Rules
1. `@src/*` alias is allowed only for `apps/backend-template/*`.
2. `packages/*` must not import from `apps/*` through relative paths.
3. `apps/service-management/*` must not import backend-template internals.
4. Imports from `sdk-clients/*` are blocked outside `sdk-clients/*` itself.
5. Temporary migration bridges must be allowlisted by exact file path.

## Enforcement
- CI script: `ci-cd/check-workspace-boundaries.js`
- NPM script: `npm run arch:check-workspace-boundaries`
- `ci:gate` now includes workspace boundary validation before tests/build.

## Evidence
- Unit tests:
  - `ci-cd/test/check-workspace-boundaries.test.ts`
- Gate run:
  - `npm run ci:gate` passing with boundary check enabled.
