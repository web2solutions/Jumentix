# Requirement 065 - Commit/Push Integrity and Real CI Enforcement

## Context
- Commits and pushes must never rely on bypass flags or fake test outcomes.
- Local hooks must execute real validation so pushed code has a high probability of passing remote CI.

## Mandatory Rules
1. Do not use `--no-verify` in any automated git workflow.
2. Hook scripts must not auto-amend commits with bypass flags.
3. Integration scripts must not use `--passWithNoTests` for required framework suites.
4. `pre-push` and `pre-commit` must select the executable quality gate defined by
   Requirement `087` before allowing publication or a commit.
5. `pre-commit` must stage generated changelog updates explicitly before executing the
   selected gate.
6. Pull request CI must execute the branch-aware gate: unit tests for `dev`, and the
   complete matrix for `main`; full-matrix cells must fail closed when required.
7. Required commands must propagate non-zero exit status; masked failures, swallowed errors, unconditional success fallbacks, and `--passWithNoTests` are prohibited.
8. Scope-aware execution must not omit required matrix cells at commit, push, or PR boundaries.

## Implementation Notes
- Husky `post-commit` is no-op for mutating operations.
- Husky `pre-commit` updates/stages changelog and executes the branch-aware gate.
- Required integration suites fail when no tests are found.

## Acceptance Criteria
- No `--no-verify` usage remains in tracked automation files.
- No `--passWithNoTests` remains in required integration scripts.
- Commit/push/merge quality gates match their `dev` or `main` destination.
- Main PR CI reports every required matrix cell and cannot succeed with an incomplete matrix.
- A deliberate failing-test verification proves failure propagation at all three boundaries.
