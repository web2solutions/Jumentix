# Requirement 090 - Focused Epic Task Grouping and Agent Delegation

## Context

Jumentix work must remain cohesive as the number of tasks and collaborating agents grows.
Task lists without a focused parent outcome make prioritization, ownership, delivery evidence,
and cross-agent coordination ambiguous.

## Mandatory Rules

1. Every executable task must belong to exactly one focused epic in Linear (Requirement `095`).
2. An epic must describe one cohesive product, architecture, security, quality, documentation,
   governance, or operational outcome.
3. Every active epic must be associated with exactly one open milestone.
4. The milestone must define a clear delivery target, description, due date, and lifecycle state.
5. A milestone may coordinate multiple focused epics only when they contribute to the same
   release or delivery target.
6. Catch-all epics, catch-all milestones, and epics that combine unrelated outcomes are
   prohibited.
7. The epic and all of its child tasks must use the same milestone. An exception requires an
   explicit rationale recorded in the epic, affected task, and pull request.
8. Epic end dates and child-task end dates must not exceed the milestone due date unless the
   milestone is formally replanned first.
9. A closed milestone cannot receive new or active epics. Incomplete epics must be moved to a
   new open milestone with an auditable carry-over record before the current milestone closes.
10. Every task must declare exactly one primary nature using the canonical nature labels:
   `feature`, `bug`, `security`, `governance`, `docs`, `refactor`, `test`, `ci`, `release`,
   or `chore`.
11. Tasks must be grouped by nature inside their focused epic. Supporting tasks with a different
   nature, such as tests or documentation for a feature, remain separate child tasks under the
   same epic and retain their own nature.
12. A task that spans unrelated outcomes or more than one primary nature must be decomposed into
   separate child tasks before execution.
13. The epic relationship must be represented by the task's Linear Project association and, when
    available, Linear parent/sub-issue metadata. A text-only epic reference is insufficient when
    structured linkage is available.
14. The milestone relationship must use Linear Project and Issue milestone metadata. A text-only
    milestone reference is insufficient.
15. Agent planning and delegation happen at epic level after the epic milestone is validated and
    before child tasks are assigned.
16. An agent may execute a child task only when the agent is assigned or delegated to that task's
   parent epic and is recorded as available or busy in the canonical Agent Registry.
17. Each child task still has one accountable executing agent, its own issue, project metadata,
    branch, commits, pull request, validation evidence, and closure record.
18. Multiple agents may collaborate within one epic, but their child-task boundaries must not
    overlap. Cross-epic work requires explicit delegation to each epic and separate tasks.
19. The canonical Agent Registry must record the active epic and assigned child task for agents
    performing work.
20. Epic and task records must maintain mandatory project fields, milestone, labels, dates, estimates,
    assignee information, and bidirectional PR/commit traceability.
21. Epics are planning and coordination containers. They do not replace task-owned delivery
    branches or pull requests.

## Required Planning Sequence

1. Define or select an open milestone with a delivery target and due date.
2. Define or select the focused epic and associate it with that milestone.
3. Confirm the epic's outcome, scope boundaries, priority, dates, estimate, and owner.
4. Decompose the outcome into child tasks of no more than eight story points.
5. Assign the epic milestone and one primary nature to each child task, then group related child
   tasks by nature.
6. Delegate available agents to the epic.
7. Assign non-overlapping child tasks to agents delegated to that epic.
8. Record branch checks, active epic, and assigned task in the canonical Agent Registry.
9. Execute each child task through its task-owned branch and pull request.
10. Close the epic only after all required child tasks and evidence are complete.
11. Close the milestone only after its epics are complete or formally carried over.

## Acceptance Criteria

1. Linear governance requires structured parent-epic linkage for executable tasks.
2. Every active Linear Project epic and its child Issues expose the same structured Linear
   milestone.
3. Project and agent documentation define the canonical nature taxonomy and milestone lifecycle.
4. Agent playbooks validate the milestone before epic-level delegation and task-level assignment.
5. Agent Registry entries support `active_epic` and `assigned_task`.
6. Specs and bilingual governance documentation describe the milestone-backed, epic-first
   operating model.
7. Audit evidence can trace
   `milestone -> epic -> agent delegation -> child task -> branch -> commit -> PR`.

## Evidence and Scope

- Applies to humans and all supported AI agents.
- Applies to features, bugs, security, governance, documentation, refactors, tests, CI, releases,
  and chores.
- Evidence includes Linear milestone metadata, Project/Issue relationships, planning fields,
  nature labels, Agent Registry assignments, task-owned GitHub delivery records, and green
  quality gates.
- Complements requirements `056`, `057`, `064`, `067`, `076`, `078`, `081`, `084`, `085`,
  `086`, and `089`.
