# Requirement 095 - Linear Single Source of Truth and API Security

## Status
Implemented

## Policy

Linear (`https://linear.app/jumentix`) is the single source of truth for task
backlog, priority, progress, estimates, milestones, and commit/PR traceability.
Every task, bug, feature, and epic is created and maintained in Linear. No local
TODO mirror or GitHub Project board is maintained for delivery state.

## API Access and Key Security

1. The Linear API key is stored one directory above the project root in `.linear`.
2. Agents may read it at runtime only to authenticate with `https://api.linear.app/graphql`.
3. Agents must never expose, log, commit, include, or share the key.
4. The key file is outside the repository and must never be versioned.

## Supersedes

- Requirements `056` and `064`; see `documentation/md/HISTORICAL-TRANSITIONS.md`.

