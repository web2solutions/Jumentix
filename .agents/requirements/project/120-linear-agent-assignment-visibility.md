# Requirement 120 - Linear Agent Assignment Visibility

- Status: Active
- Nature: NFR (governance, multi-agent operations, Linear traceability)
- Source: Project owner decision in Codex session, 2026-08-02.
- Relates to: `078`, `089`, `090`, `095`, `097`, `102`, `119`, `121`.

## Requirement

1. **Linear MUST identify the working agent for every executable task.**
   Each Linear Issue that represents implementation, documentation, testing,
   release, governance, migration, or review work MUST expose the active
   `agent_identifier` responsible for the task.

2. **Linear Projects used as epics MUST expose agent delegation.** A Project/Epic
   MUST identify its delegated agent or coordinated agent set before child tasks
   begin execution. When multiple agents work inside the same epic, the Project
   metadata or Project Updates MUST make the current division of ownership clear.

3. **Agent assignment MUST stay synchronized with the canonical Agent Registry.**
   The Linear task/Project agent assignment, `.agents/AGENT-REGISTRY.md` mirror,
   and canonical registry state MUST agree on:
   - active agent identifier
   - active epic/project
   - assigned task
   - task status
   - blocker or handoff state when applicable

4. **Assignment changes are material progress.** Starting work, pausing, handing
   off, replacing an agent, completing a task, or moving an agent to a sibling
   task MUST be recorded in Linear through the API-first path required by `119`.
   Project Updates are required when the assignment change affects an epic,
   milestone, dependency, or delivery plan.

5. **Unassigned execution is non-compliant.** An agent MUST NOT begin product
   changes for a Linear task, Project/Epic, or delegated scope that does not
   identify the working agent. Discovery-only read operations may proceed, but
   the missing assignment must be recorded before implementation, commit, push,
   PR, or merge activity.

## Evidence

- Linear Issue/Project metadata or Project Updates showing `agent_identifier`
- Canonical Agent Registry entry with matching `active_epic` and `assigned_task`
- Local `.agents/AGENT-REGISTRY.md` mirror pinned to the canonical registry
- Project Updates recording assignment changes and handoffs
- `bun run requirements:check` and registry consistency checks
