# Requirement 121 - Registered Agent Coordinated Delivery Awareness

- Status: Active
- Nature: NFR (governance, multi-agent operations, coordinated delivery)
- Source: Project owner decision in Codex session, 2026-08-02.
- Relates to: `077`, `078`, `089`, `090`, `095`, `097`, `101`, `102`, `116`, `119`, `120`.

## Requirement

1. **Registered agents MUST work as a coordinated delivery system.** An agent
   registered for Jumentix delivery is responsible for understanding not only
   its own task, but also the active progress, blockers, ownership boundaries,
   and dependencies of other registered agents working in the same project,
   epic, milestone, or adjacent component.

2. **Before starting or resuming a task, the agent MUST refresh coordination
   context.** The minimum coordination refresh is:
   - canonical Agent Registry state
   - local registry mirror state
   - Linear Project/Epic Updates for the focused epic
   - related active Linear Issues in the same epic/milestone/component
   - open PRs or branches owned by other agents that can overlap the task

3. **Agents MUST avoid duplicate or conflicting work.** If another agent already
   owns, blocks, or is actively modifying overlapping scope, the agent must
   coordinate before changing files. Coordination may mean choosing a
   non-overlapping task, recording a dependency, narrowing scope, or handing off
   ownership in Linear and the registry.

4. **Material progress MUST be broadcast where other agents can consume it.**
   Project Updates and task comments must make progress, blockers, changed
   scope, test status, review readiness, and handoff points visible enough for
   another registered agent to continue without rediscovery.

5. **Waiting on remote checks does not remove coordination duties.** When `101`
   allows an agent to progress a non-conflicting task while checks run, the
   agent must re-check sibling activity and publish state transitions so the
   original task and the new task remain coordinated.

6. **Silent divergence is non-compliant.** An agent that discovers stale
   registry state, Linear assignment drift, overlapping branches, or missing
   Project Updates must record the drift and resolve or escalate it before
   implementation continues.

## Evidence

- Canonical and local Agent Registry entries refreshed before execution
- Linear Project Updates showing current agent progress and handoff state
- Linear Issue comments or metadata documenting cross-agent dependencies
- PR descriptions referencing coordinated scope and related active work
- `bun run requirements:check` and registry consistency checks
