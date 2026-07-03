# Requirement 064 - GitHub Project Single Source of Truth

## Status
Implemented

## Policy
- The GitHub Project **Jumentix** is the single source of truth for:
  - task backlog,
  - priorities,
  - status/progress,
  - estimation metadata,
  - commit/PR traceability.

## Operational Rules
1. Every new task/bug/feature must be created and managed in GitHub Issues + GitHub Project.
2. Local files (for example `.agents/project-todos.md`) are reference snapshots only, not authoritative planning sources.
3. PRs must reference related issue/project item links and keep status synchronization in GitHub Project.

## Evidence
- Governance requirement registered in `.agents/README.md`.
- Local task tracker now points to GitHub Project as canonical source.
