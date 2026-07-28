# Jumentix Project Governance

This project uses the **Jumentix Linear workspace** as the single source of truth for project
management and new work. A Linear Project is an epic and a Linear Issue is an executable task.

## Single Source of Truth Rules

1. Every bug, feature, refactor, and technical task executed by humans or AI must exist as a
   Linear Issue.
2. Every tracked Issue must belong to exactly one focused Linear Project.
3. Project fields are mandatory for active items:
   - `Status`
   - `Priority`
   - `Size`
   - `Estimate`
   - `Start date`
   - `End date`
   - `Milestone`
4. No work starts without a linked Linear Issue and Project.
5. Task progress must be published in the Linear Project's `Project Updates` feed; Issue status,
   comments, pull-request activity, and local notes alone are insufficient.
6. All executed tasks must keep governance metadata updated (status, priority, estimates, cycle/iteration, start/end dates, labels, assignee, PR/commit links).

## Focused Epics and Task Nature

1. Every active epic belongs to exactly one open GitHub milestone.
2. Every executable task belongs to exactly one focused epic through structured GitHub parentage
   and uses the same milestone as that epic.
3. Milestones define a delivery target and due date. Epic and task dates remain within that date.
4. Each epic represents one cohesive outcome and must not serve as a catch-all backlog.
5. Every child task has exactly one primary nature: `feature`, `bug`, `security`, `governance`,
   `docs`, `refactor`, `test`, `ci`, `release`, or `chore`.
6. Tasks are grouped by nature within the epic. Different supporting natures use separate child
   tasks while remaining tied to the same outcome.
7. Work that crosses unrelated outcomes is split across focused epics.
8. The milestone is validated before agent delegation is established at epic level.
9. Only agents delegated to an epic may execute its child tasks, with one accountable agent and
   non-overlapping scope per task.
10. The canonical Agent Registry records each executing agent's `active_epic` and `assigned_task`.
11. A milestone closes only when its epics are complete or remaining work has an auditable
    carry-over to another milestone.

## Linear Project Updates

1. Every executing agent publishes a Project Update when a task starts, after material progress,
   when a blocker or material risk changes, when its PR becomes review-ready, and at completion
   or handoff.
2. Each task section identifies the Linear Issue, accountable agent, current status, completed
   outcome, branch/PR/commit, exact gate state, blockers or risks, and next action.
3. Concurrent work uses separate task-and-agent sections.
4. Pending, missing, skipped, cancelled, timed-out, or failed required gates are never reported
   as passing.
5. Every completed task, including the dedicated documentation Issue, has a final Project Update.
6. Missing final updates, unresolved blockers, or incomplete required gates block Project
   completion.

## PR Governance

Each PR must include:

- Related issue link(s)
- Focused parent epic link
- Associated milestone
- Related Linear Project and latest task-specific Project Update
- Acceptance criteria and validation evidence
- Coverage and quality-gate evidence
- Task-owned branch name and nature-prefixed PR title
- Source and target branches, proving the task PR targets `dev`
- Destination-aware gate results for commit, push, merge, and PR boundaries; full-matrix results for `main` promotion
- False-green prevention evidence, including real failure propagation

If a PR is not linked to project work items, it is out of process.

### Task-owned branch and PR policy (mandatory)

1. Every task must have its own branch and its own PR.
2. A branch or PR must not combine separately tracked tasks.
3. Codex branches use `codex/<nature>/<issue-id>-<short-slug>`.
4. PR titles use `[<Nature>] <concise outcome>`.
5. Allowed nature values are `feature`, `fix`, `security`, `governance`, `docs`, `refactor`, `test`, `ci`, `release`, and `chore`.
6. The nature declared by the branch and PR title must match.
7. Any exception must be explicitly approved and recorded in the linked issue and PR.
8. Every task PR must target `dev`.
9. Only a release-promotion PR whose source branch is `dev` may target `main`.
10. A `dev` to `main` promotion PR introduces no unreviewed changes and references the task PRs and issues already merged into `dev`.
11. Direct pushes, merges, or task/topic PRs to `main` are prohibited.
12. Every commit, push, and PR runs the complete repository-declared test matrix.
13. Missing, skipped, empty, cancelled, timed-out, aborted, or unreported required matrix cells fail the gate.
14. Test failures and discovery failures must propagate a non-zero status; false-green fallbacks are prohibited.

### Canonical agent registry evidence

1. The independent Agent Registry repository and its `main` branch remain the coordination
   source of truth.
2. A consumer mirror records the immutable canonical commit revision used to produce it.
3. The synchronization command resolves canonical `main`, then updates the mirror and revision
   together.
4. Commit, push, and PR gates compare the mirror with its recorded immutable revision so the
   result remains reproducible when another agent updates canonical `main` concurrently.

## Documentation Governance

1. Every executed task must update software docs, product docs, and spec docs when affected.
2. Documentation must be maintained in sync with implementation and governance changes.
3. Documentation must provide English and Portuguese versions.
4. Jumentix website content and navigation must provide English and Portuguese versions.
5. In Linear, an epic is a Project and an executable task is an Issue.
6. Every epic Project must contain a dedicated documentation Issue whose exclusive accountable
   outcome is synchronizing all affected documentation.
7. An epic Project must not be set to `Completed` until its dedicated documentation Issue is
   completed and links its PR, commits, changed documentation, and validation evidence.
8. A missing, cancelled, unowned, or incomplete documentation Issue blocks epic completion.

### Priority-based PR grouping (mandatory)

PRs must be created by priority group:

1. `P0` tasks in dedicated PR(s) containing only `P0` items.
2. `P1` tasks in dedicated PR(s) containing only `P1` items.
3. `P2` tasks in dedicated PR(s) containing only `P2` items.

Mixing `P0`, `P1`, and `P2` work in the same PR is not allowed.

## Backlog and Delivery Flow

1. Create/triage issue.
2. Create or select an open milestone.
3. Create or select the focused parent epic, associate it with the milestone, and establish
   structured parentage.
4. Add the Issue to its focused Linear Project and assign the epic milestone.
5. Set nature, field values, and cycle dates within the milestone due date.
6. Delegate available agents to the epic, then assign its non-overlapping child tasks.
7. Create the task-owned, nature-prefixed branch.
8. Implement with a dedicated PR targeting `dev` and linked to the milestone, epic, issue, and
   project.
9. Promote `dev` to `main` only through a release-promotion PR after the complete matrix passes.
10. Publish task progress through the required Linear Project Update cadence.
11. Verify every task has a final Project Update and the dedicated documentation Issue and its
    evidence are complete.
12. Move Project status (`Backlog` -> `Ready` -> `In progress` -> `In review` -> `Completed`).

## Cycle and Estimation Policy

1. Cycle window standard: 14 days (`Start date` / `End date` in project fields).
2. Every active task must have:
   - `Priority`
   - `Estimate` (story points)
   - cycle dates
3. Maximum story points per task item: **8**.
4. Any item above 8 points must be split into subtasks.
5. Subtasks inherit parent priority and cycle.
