# Requirement 063 - Workspace Coverage Policy Governance

## Status
Implemented

## Scope
- Keep global coverage thresholds enforced at root level.
- Prevent non-governed placeholder test scripts in workspace packages.
- Fail fast in `ci:gate` when coverage policy contracts are violated.

## Rules
1. Root `jest.config.js` must keep global minimum coverage thresholds:
   - `statements >= 99`
   - `lines >= 99`
   - `functions >= 99`
   - `branches >= 90`
2. Every workspace package/app must have a `test` script.
3. Placeholder `test` scripts are forbidden for runtime packages.
4. Placeholder tests are allowed only for explicitly allowlisted config/placeholder packages.

## Enforcement
- CI script: `ci-cd/check-workspace-coverage-policy.js`
- NPM script: `npm run workspace:check-coverage-policy`
- Integrated in: `npm run ci:gate`

## Evidence
- Unit tests:
  - `apps/backend-template/test/unit/ci-cd/check-workspace-coverage-policy.test.ts`
- Runtime packages updated to non-placeholder `test` scripts (`npm run typecheck`) where applicable.
