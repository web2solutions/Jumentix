# Spec Project Board Contract (GitHub Project Jumentix)

This document defines how the GitHub Project board is part of Spec Development Driven execution.

## Canonical Project Board

- Board: [GitHub Project - Jumentix](https://github.com/users/web2solutions/projects/1)
- Owner: `web2solutions`
- Repository scope: `web2solutions/aaa-typescript-boilerplate`

Snapshot baseline (2026-07-24):

1. Project is active (`closed: false`).
2. Governance fields are available and required (`19` configured fields).
3. Work items are managed as issue-backed project items (current scale in board history already above initial MVP stage).

## Mandatory Planning Fields

Each item must maintain:

1. `Status`
2. `Priority`
3. `Size`
4. `Estimate`
5. `Start date`
6. `End date`
7. `Iteration` (when available in cycle planning)
8. `Milestone`

## Required Labels for Task Nature

Every executable task must have exactly one primary nature label:

1. `feature`
2. `bug`
3. `security`
4. `governance`
5. `docs`
6. `refactor`
7. `test`
8. `ci`
9. `release`
10. `chore`

Strategic stream labels are additive (for example `todo-mvp`, `epic`, `iteration-a`, `iteration-b`).

## Focused Epic Contract

1. Every executable task must belong to exactly one focused epic.
2. Every active epic must be associated with exactly one open GitHub milestone.
3. The epic and all child tasks use the same milestone unless an explicit exception is recorded.
4. The milestone defines a delivery target, description, due date, and lifecycle state.
5. Epic and task end dates must not exceed the milestone due date without formal replanning.
6. A milestone may contain multiple focused epics only when they serve the same delivery target.
7. The epic must describe one cohesive outcome and must not be a catch-all backlog.
8. Parentage must use GitHub sub-issues or the Project `Parent issue` field when available.
9. Milestone association must use GitHub Issue and Project milestone metadata.
10. Tasks are grouped by primary nature inside the epic. Supporting work with a different nature
   is tracked as a separate child task under the same cohesive outcome.
11. Epic planning defines milestone, priority, scope boundaries, dates, estimate, owner, and
    agent delegation.
12. Child tasks retain independent estimates of no more than eight points, assignees, branches,
   commits, pull requests, and evidence.
13. An epic is complete only when its required child tasks and audit evidence are complete.
14. A milestone closes only after its epics complete or incomplete work is formally carried to
    another open milestone.

## Agent Delegation Contract

1. The epic milestone and delivery dates are validated before agent delegation.
2. Agent delegation is decided and recorded at epic level before child-task assignment.
3. Only agents delegated to an epic may accept its child tasks.
4. One accountable agent owns each child task; multiple agents must use non-overlapping task
   boundaries.
5. The canonical Agent Registry records `active_epic` and `assigned_task`.
6. Cross-epic work requires explicit delegation and separate child tasks for each epic.

## Spec-Driven Workflow Through the Board

1. Intake:
   - create or select an open milestone and a focused epic, then create a child issue with clear
     objective and acceptance criteria.
2. Planning:
   - assign milestone, parent epic, primary nature, priority, size, estimate, dates, and labels;
   - delegate agents to the epic before assigning child tasks.
3. Spec drafting:
   - list required spec resources before implementation.
4. Delivery:
   - link commits/PRs and capture evidence.
5. Closure:
   - set a child task to `Done` only after green checks and docs/agents sync;
   - close the epic only after all required child tasks and evidence are complete.

## PR Linking Contract

Every PR must reference:

1. related issue(s)
2. focused parent epic
3. associated milestone
4. project item scope
5. changed spec resources
6. evidence summary (tests/coverage/security)

And every issue should reflect:

1. PR URL(s)
2. merge/close status
3. residual follow-up items (if any)

## Anti-Drift Rule

If local todo snapshots and project board diverge, the project board is the source of truth and local docs must be synchronized in the same cycle.
