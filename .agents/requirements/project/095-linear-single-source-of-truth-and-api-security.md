# Requirement 095 - Linear Single Source of Truth and API Security

## Status
Implemented

## Context
Project execution must be managed from one authoritative tracking system to avoid drift. Linear is the canonical platform, replacing GitHub Project as the sole source of truth for planning and delivery.

## Policy
- **Linear** (`https://linear.app/jumentix`) is the single source of truth for:
  - task backlog and prioritization
  - status and progress tracking
  - estimation and planning metadata
  - commit/PR traceability
  - epic and milestone management

## Operational Rules
1. Every task, bug, feature, and epic must be created and managed in Linear.
2. Local files (e.g. `.agents/project-todos.md`) are reference snapshots only, not authoritative planning sources.
3. PRs must reference related Linear issue links and keep status synchronization in Linear.

## API Access and Key Security
1. The Linear API key is stored one directory level above the project root in a file named `.linear`.
2. Agents may read the `../.linear` file at runtime for API authentication via the `Authorization: Bearer <key>` header to `https://api.linear.app/graphql`.
3. Agents must never:
   - expose, log, or echo the key value
   - commit the key or any file containing it to version control
   - include the key in PR descriptions, comments, or any output visible outside the agent's runtime
   - share the key with other agents, users, or systems not explicitly authorized
4. The `.linear` file is outside the repository directory and must never be added to `.gitignore` or version control.

## Supersedes
- Requirement `056` (GitHub Project single source of truth)
- Requirement `064` (GitHub Project single source of truth)

## Evidence
- Governance requirement registered in `.agents/README.md`.
- NFR registry updated in `.agents/NFR-REGISTRY.md`.
- Agent instruction files (`AGENTS.md`, `CLAUDE.md`, `GROK.md`) updated with API key access rules.
- Governance and project management docs updated.
