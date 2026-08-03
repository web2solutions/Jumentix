# Requirement 079 - Main Branch Protection and Branching Principles

## Context

The `main` branch is the protected release baseline and `dev` is the development integration
baseline. Direct local development on `main` increases risk of bypassing planning, traceability,
and delivery governance.

## Requirement

1. `main` must not be used as a local working branch for new changes.
2. Every change must start from a dedicated branch that follows project branching principles.
3. Branches must be tied to planned/tracked work items in Linear (Requirement `095`).
4. Delivery to `main` must happen through PR flow with mandatory checks.
5. Pull-request review is optional. Branch protection and rulesets must not configure a required
   approval count.
6. The `dev`-first path, required CI/coverage/security checks, conversation resolution, and
   false-green protections remain mandatory. Every required check must be reported and terminal
   green.
7. Administrative bypass is prohibited for normal delivery and never converts a failed, missing,
   skipped, cancelled, timed-out, or incomplete required check into success.

## Branching Principles

1. Fetch both protected refs and create new task branches from the latest `dev`.
2. Create a scoped branch (for example `feat/*`, `fix/*`, `chore/*`, or project-approved branch prefix).
3. Keep commits and PR scope aligned with task nature and priority grouping rules.
4. Merge only after required quality, coverage, and security gates are green.

## Acceptance Criteria

1. Governance docs and agent behavior prohibit local direct change on `main`.
2. New implementation work is traceable to branch -> PR -> Linear Issue -> Linear Project.
3. Any emergency exception is documented in the related issue/PR with audit rationale.
4. Repository protection matches the review-optional policy and cannot override a failed,
   missing, skipped, cancelled, timed-out, or incomplete quality gate.
