# Requirement 090 - Focused Epic Task Grouping and Agent Delegation

## Context

Jumentix work must remain cohesive as the number of tasks and collaborating agents grows.
Task lists without a focused parent outcome make prioritization, ownership, delivery evidence,
and cross-agent coordination ambiguous.

## Mandatory Rules

1. Every executable task must belong to exactly one focused epic in GitHub Project Jumentix.
2. An epic must describe one cohesive product, architecture, security, quality, documentation,
   governance, or operational outcome.
3. Catch-all epics and epics that combine unrelated outcomes are prohibited.
4. Every task must declare exactly one primary nature using the canonical nature labels:
   `feature`, `bug`, `security`, `governance`, `docs`, `refactor`, `test`, `ci`, `release`,
   or `chore`.
5. Tasks must be grouped by nature inside their focused epic. Supporting tasks with a different
   nature, such as tests or documentation for a feature, remain separate child tasks under the
   same epic and retain their own nature.
6. A task that spans unrelated outcomes or more than one primary nature must be decomposed into
   separate child tasks before execution.
7. The epic relationship must be represented by GitHub sub-issue parentage or the Project
   `Parent issue` field. A text-only epic reference is insufficient when structured parentage is
   available.
8. Agent planning and delegation happen at epic level before child tasks are assigned.
9. An agent may execute a child task only when the agent is assigned or delegated to that task's
   parent epic and is recorded as available or busy in the canonical Agent Registry.
10. Each child task still has one accountable executing agent, its own issue, project metadata,
    branch, commits, pull request, validation evidence, and closure record.
11. Multiple agents may collaborate within one epic, but their child-task boundaries must not
    overlap. Cross-epic work requires explicit delegation to each epic and separate tasks.
12. The canonical Agent Registry must record the active epic and assigned child task for agents
    performing work.
13. Epic and task records must maintain mandatory project fields, labels, dates, estimates,
    assignee information, and bidirectional PR/commit traceability.
14. Epics are planning and coordination containers. They do not replace task-owned delivery
    branches or pull requests.

## Required Planning Sequence

1. Define or select the focused epic.
2. Confirm the epic's outcome, scope boundaries, priority, dates, estimate, and owner.
3. Decompose the outcome into child tasks of no more than eight story points.
4. Assign one primary nature to each child task and group related child tasks by nature.
5. Delegate available agents to the epic.
6. Assign non-overlapping child tasks to agents delegated to that epic.
7. Record branch checks, active epic, and assigned task in the canonical Agent Registry.
8. Execute each child task through its task-owned branch and pull request.
9. Close the epic only after all required child tasks and evidence are complete.

## Acceptance Criteria

1. GitHub Project governance requires structured parent-epic linkage for executable tasks.
2. Project and agent documentation define the canonical nature taxonomy.
3. Agent playbooks require epic-level delegation before task-level assignment.
4. Agent Registry entries support `active_epic` and `assigned_task`.
5. Specs and bilingual governance documentation describe the epic-first operating model.
6. Audit evidence can trace `epic -> agent delegation -> child task -> branch -> commit -> PR`.

## Evidence and Scope

- Applies to humans and all supported AI agents.
- Applies to features, bugs, security, governance, documentation, refactors, tests, CI, releases,
  and chores.
- Evidence includes GitHub parent/sub-issue relationships, Project fields, nature labels, Agent
  Registry assignments, task-owned delivery records, and green quality gates.
- Complements requirements `056`, `057`, `064`, `067`, `076`, `078`, `081`, `084`, `085`,
  `086`, and `089`.
