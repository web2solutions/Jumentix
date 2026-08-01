# Requirement 088 - Task-Branch Change-Focused Tests

## Requirement

Task-owned branches must validate only the tests directly changed by the task or unit tests
related to changed implementation files during commit and push. Pull requests targeting
`dev` must execute the complete unit suite. The repository-owned GitHub Actions gate
runs for PRs and for pushes to `dev` and `main` under Requirement `113`.

## Mandatory Rules

1. `ci:gate:task` reads the task diff and selects changed unit tests first.
2. If no unit test changed but implementation changed, it runs Jest related-test discovery.
3. Documentation-only changes create auditable `not-applicable` evidence and run no
   unrelated test suite.
4. A missing, crashed, empty, or failing related-test execution fails closed; no
   `--passWithNoTests`, masked failure, or synthetic success is allowed.
5. Commit and push hooks on task branches invoke `ci:gate:task`.
6. `dev` commit, push, merge, and PR paths invoke the complete `test:unit` suite.
7. `main` commit, push, merge, and PR paths invoke `ci:gate:strict`.
8. GitHub Actions is the canonical target-aware PR gate and runs direct pushes only
   for `dev` and `main`.

## Acceptance Criteria

- Tests prove changed-test, related-test, docs-only, missing-status, and crash outcomes.
- Tests prove task branches, `dev`, and `main` select distinct gates.
- The tracked GitHub Actions workflow accepts PRs and only `dev`/`main` pushes.
- Requirements, NFR registry, agent guidance, and Spec Development Driven resources are
  synchronized with the executable policy.

## Status

Active.

## Evidence

- GitHub issue `#191`
- Linear issue `JUM-504`
- `ci-cd/run-task-change-tests.js`
- `apps/backend-template/test/unit/ci-cd/run-task-change-tests.test.ts`
