# Requirement 084 - Dev Branch Single Source of Truth

## Context

The project workflow requires a single integration branch for all ongoing development to reduce drift and avoid conflicting branch strategies.

## Requirement

1. `dev` is the single source of truth for development work.
2. New feature, bugfix, and chore branches must be created from `dev`.
3. Pull requests from development branches must target `dev` as the base branch.
4. Merge to `main` must happen only through the established release/promote flow.

## Acceptance Criteria

1. Governance documentation explicitly states `dev` as the development source-of-truth branch.
2. Branching guidance requires branch creation from `dev`.
3. PR guidance requires merge target `dev` for ongoing implementation work.
