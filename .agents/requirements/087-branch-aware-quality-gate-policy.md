# Requirement 087 - Branch-Aware Quality Gate Policy

## Context

Jumentix needs fast, credible feedback while preserving release-grade evidence at the
protected production boundary. Applying the full matrix to every task-branch commit,
push, and `dev` merge delays delivery without increasing the assurance appropriate to
that integration stage. Applying a reduced gate to `main` would weaken release safety.

## Mandatory Rules

1. Commits, pushes, and merges whose destination is `dev` must run only the canonical
   unit-test gate: `pnpm run test:unit`.
2. Task-owned branches are treated as `dev`-bound unless an explicit target is supplied;
   they must therefore run only the unit-test gate locally.
3. Commits, pushes, and merges whose destination is `main` must run the canonical full
   matrix: `pnpm run ci:gate:strict`.
4. A PR to `dev` runs the unit-test gate; a release-promotion PR from `dev` to `main`
   runs the full matrix.
5. The branch-aware selector must fail closed for command crashes, missing status, and
   non-zero exit status, and must emit auditable JSON evidence.
6. This policy does not relax branch protection, task isolation, coverage thresholds,
   security checks, or the rule that only `dev` may be promoted to `main`.
7. Bypass flags, fake outcomes, hidden failures, and direct changes to `main` remain
   prohibited.

## Implementation Contract

- `pnpm run ci:gate:branch` selects the correct gate using
  `JUMENTIX_QUALITY_GATE_TARGET`.
- `.husky/pre-commit`, `.husky/pre-push`, and `.husky/pre-merge-commit` invoke the
  selector.
- GitHub Actions passes the PR base branch or pushed branch explicitly.
- CircleCI passes the current branch; the GitHub release-promotion PR gate remains the
  authoritative target-aware enforcement for `dev` to `main` promotion.

## Acceptance Criteria

- `dev` and task-branch paths invoke `test:unit` and do not invoke the full matrix.
- `main` paths invoke `ci:gate:strict`.
- Unit tests cover branch selection, evidence generation, failed status, and crashes.
- Requirements, NFR registry, agent instructions, and Spec Development Driven documents
  are synchronized in the same delivery PR.

## Status

Active.
