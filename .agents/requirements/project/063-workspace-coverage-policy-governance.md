# Requirement 063 - Workspace Coverage Policy Governance

## Status
Implemented

## Scope
- Keep global coverage thresholds enforced at root level.
- Prevent non-governed placeholder test scripts in workspace packages.
- Fail fast in `ci:gate` when coverage policy contracts are violated.

## Rules
1. Root `jest.config.js` must keep global minimum coverage thresholds, and they
   are the four the authority enforces (`ci-cd/check-coverage-thresholds.js`):
   - `statements >= 98`
   - `lines >= 98`
   - `functions >= 98`
   - `branches >= 98`

   JUM-681 settled the four at 98. `branches` was 90 — ten points below its
   neighbours, which is not a threshold but a place where the failure paths went
   unmeasured. A metric may sit below its threshold only through a dated entry
   in `ACCEPTED_BELOW_THRESHOLD`, which names the issue that owns it and is a
   ratchet: below the recorded floor fails, and reaching the threshold with the
   entry still listed fails as well.
2. Every workspace package/app must have a `test` script.
3. Placeholder `test` scripts are forbidden for runtime packages.
4. Placeholder tests are allowed only for explicitly allowlisted config/placeholder packages.

## Enforcement
- CI script: `ci-cd/check-workspace-coverage-policy.js`, which reads the
  exception register from `ci-cd/check-coverage-thresholds.js` rather than
  keeping a second copy of the numbers.
- NPM script: `bun run workspace:check-coverage-policy`
- Integrated in: `bun run ci:gate`

## Evidence
- Unit tests:
  - `ci-cd/test/check-workspace-coverage-policy.test.ts`
- Runtime packages updated to non-placeholder `test` scripts (`npm run typecheck`) where applicable.
