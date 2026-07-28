# Requirement 079 - Main Branch Protection and Branching Principles

## Context

The `main` branch is the protected integration baseline. Direct local development on `main` increases risk of bypassing planning, traceability, and review governance.

## Requirement

1. `main` must not be used as a local working branch for new changes.
2. Every change must start from a dedicated branch that follows project branching principles.
3. Branches must be tied to planned/tracked work items in Linear (Requirement `095`).
4. Delivery to `main` must happen through PR flow with mandatory checks.
5. Repository administrators may bypass the required-review count only after explicit project-owner approval is recorded in the task or PR.
6. Administrative review bypass never waives the `dev`-first path, required CI/coverage/security checks, conversation resolution, or false-green protections. Every required check must be reported and terminal green.

## Branching Principles

1. Sync from `main` (or approved base branch) before creating a new branch.
2. Create a scoped branch (for example `feat/*`, `fix/*`, `chore/*`, or project-approved branch prefix).
3. Keep commits and PR scope aligned with task nature and priority grouping rules.
4. Merge only after required quality, coverage, and security gates are green.

## Acceptance Criteria

1. Governance docs and agent behavior prohibit local direct change on `main`.
2. New implementation work is traceable to branch -> PR -> issue -> project item.
3. Any emergency exception is documented in the related issue/PR with audit rationale.
4. Administrative review-count bypass remains auditable and cannot override a failed, missing, skipped, cancelled, timed-out, or incomplete quality gate.
