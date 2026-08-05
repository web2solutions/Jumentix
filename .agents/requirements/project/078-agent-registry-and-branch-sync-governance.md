# Requirement 078 - Agent Registry and Branch Sync Governance

## Context

Jumentix must coordinate multiple AI agents collaborating on the same repository while reducing duplicate work and conflicting execution.

## Requirement

1. Jumentix must maintain an Agent Registry system that tracks collaborating AI agents.
2. Each agent must register itself before executing any task.
3. During planning, tasks must be assigned only to available registered agents.
4. Before starting work, agents must check `main` and `dev` branch state to avoid duplicate work.

## Acceptance Criteria

1. Agent registrations are stored in Firestore (`agents` collection) as the canonical source of truth.
2. Codex is registered as the first agent.
3. Governance/spec documents reference this requirement and the branch-check rule.
4. Agent instruction files include mandatory registration + branch-sync checks.
5. A local snapshot `.agents/registry-snapshot.json` may be generated with `bun run agent-registry:sync` for offline consultation; it is regenerable and ignored by Git.
