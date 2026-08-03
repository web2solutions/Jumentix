# Requirement 087 - Branch-Aware Quality Gate Policy

## Context

Jumentix needs fast, credible feedback while preserving release-grade evidence at the
protected production boundary. Applying the full matrix to every task-branch commit,
push, and `dev` merge delays delivery without increasing the assurance appropriate to
that integration stage. Applying a reduced gate to `main` would weaken release safety.

## Mandatory Rules

1. Commits, pushes, and merges whose destination is `dev` must run the canonical
   unit-test gate: `bun run test:unit`.
2. Task-owned branches must run only the change-focused gate defined by Requirement
   `088`; they must not run the whole unit suite locally unless their changed test plan
   selects it.
3. Commits, pushes, and merges whose destination is `main` must run the canonical full
   non-coverage matrix: `bun run ci:gate:strict`. Full coverage is the required
   CircleCI `coverage` job for `dev` and `main`.
4. Local commits and pushes to feature, docs, fix, and other task branches run
   only specialized changed/related tests. A PR to `dev` runs the full local
   non-coverage matrix in CircleCI; a release-promotion PR from `dev` to `main`
   runs the same full matrix.
5. The branch-aware selector must fail closed for command crashes, missing status, and
   non-zero exit status, and must emit auditable JSON evidence.
6. This policy does not relax branch protection, task isolation, coverage thresholds,
   security checks, or the rule that only `dev` may be promoted to `main`.
7. Bypass flags, fake outcomes, hidden failures, and direct changes to `main` remain
   prohibited.

## Implementation Contract

- `bun run ci:gate:branch` selects the correct task, `dev`, or `main` gate using
  `JUMENTIX_QUALITY_GATE_TARGET`.
- `.husky/pre-commit`, `.husky/pre-push`, and `.husky/pre-merge-commit` invoke the
  selector.
- CircleCI passes the PR base branch or pushed branch explicitly.
- CircleCI runs the tracked target-aware workflow for PRs to `dev`, promotions
  to `main`, and pushes to both long-lived branches while Requirement `113`
  keeps GitHub Actions disabled by billing.

## Acceptance Criteria

- Task branches invoke `ci:gate:task`; direct `dev` pushes invoke `test:unit`;
  PRs targeting `dev` invoke `ci:gate:strict`.
- `main` paths invoke `ci:gate:strict`.
- Unit tests cover branch selection, evidence generation, failed status, and crashes.
- Requirements, NFR registry, agent instructions, and Spec Development Driven documents
  are synchronized in the same delivery PR.

## Status

Active.

## Evidence

- GitHub issue `#191`
- Linear issue `JUM-504`
- `.circleci/config.yml`
- `ci-cd/run-branch-quality-gate.js`
