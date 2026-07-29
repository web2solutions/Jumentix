# Requirement 064 - GitHub Project Single Source of Truth

## Status
Implemented

## Policy (Superseded)

**Note**: This requirement is superseded by Requirement `095` (Linear as Single Source of Truth).

- ~~The GitHub Project **Jumentix** is the single source of truth for:~~
  - ~~task backlog,~~
  - ~~priorities,~~
  - ~~status/progress,~~
  - ~~estimation metadata,~~
  - ~~commit/PR traceability.~~

## Operational Rules
1. ~~Every new task/bug/feature must be created and managed in GitHub Issues + GitHub Project.~~
2. ~~Local files (for example `.agents/project-todos.md`) are reference snapshots only, not authoritative planning sources.~~
3. ~~PRs must reference related issue/project item links and keep status synchronization in GitHub Project.~~

## Evidence
- Requirement `094` now governs single-source-of-truth policy.
- Linear is the canonical planning source; historical GitHub Project references are preserved for audit only.
