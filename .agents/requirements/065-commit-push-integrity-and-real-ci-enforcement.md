# Requirement 065 - Commit/Push Integrity and Real CI Enforcement

## Context
- Commits and pushes must never rely on bypass flags or fake test outcomes.
- Local hooks must execute real validation so pushed code has a high probability of passing remote CI.

## Mandatory Rules
1. Do not use `--no-verify` in any automated git workflow.
2. Hook scripts must not auto-amend commits with bypass flags.
3. Integration scripts must not use `--passWithNoTests` for required framework suites.
4. `pre-push` must execute strict quality gate (`ci:gate:strict`) before allowing push.
5. `pre-commit` must run real lint + unit tests and stage generated changelog updates explicitly.

## Implementation Notes
- Husky `post-commit` is no-op for mutating operations.
- Husky `pre-commit` updates/stages changelog and executes lint + unit tests.
- Required integration suites fail when no tests are found.

## Acceptance Criteria
- No `--no-verify` usage remains in tracked automation files.
- No `--passWithNoTests` remains in required integration scripts.
- Local `npm run ci:gate:strict` is enforced on push.
