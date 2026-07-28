# Jumentix Project Governance

This project uses GitHub Project **Jumentix** (`https://github.com/users/web2solutions/projects/1`) as the single source of truth for execution tracking.

## Single Source of Truth Rules

1. Every bug, feature, refactor, and technical task executed by humans or AI must exist as a GitHub Issue.
2. Every tracked issue must be added to the `Jumentix` project.
3. Project fields are mandatory for active items:
   - `Status`
   - `Priority`
   - `Size`
   - `Estimate`
   - `Start date`
   - `End date`
4. No work starts without a linked issue and project item.
5. Task progress updates must happen in the project item status, not only in local notes.
6. All executed tasks must keep governance metadata updated (status, priority, estimates, cycle/iteration, start/end dates, labels, assignee, PR/commit links).

## PR Governance

Each PR must include:

- Related issue link(s)
- Related project item context (Project: `Jumentix`)
- Acceptance criteria and validation evidence
- Coverage and quality-gate evidence
- Task-owned branch name and nature-prefixed PR title

If a PR is not linked to project work items, it is out of process.

### Task-owned branch and PR policy (mandatory)

1. Every task must have its own branch and its own PR.
2. A branch or PR must not combine separately tracked tasks.
3. Codex branches use `codex/<nature>/<issue-id>-<short-slug>`.
4. PR titles use `[<Nature>] <concise outcome>`.
5. Allowed nature values are `feature`, `fix`, `security`, `governance`, `docs`, `refactor`, `test`, `ci`, `release`, and `chore`.
6. The nature declared by the branch and PR title must match.
7. Any exception must be explicitly approved and recorded in the linked issue and PR.

## Documentation Governance

1. Every executed task must update software docs, product docs, and spec docs when affected.
2. Documentation must be maintained in sync with implementation and governance changes.
3. Documentation must provide English and Portuguese versions.
4. Jumentix website content and navigation must provide English and Portuguese versions.

### Priority-based PR grouping (mandatory)

PRs must be created by priority group:

1. `P0` tasks in dedicated PR(s) containing only `P0` items.
2. `P1` tasks in dedicated PR(s) containing only `P1` items.
3. `P2` tasks in dedicated PR(s) containing only `P2` items.

Mixing `P0`, `P1`, and `P2` work in the same PR is not allowed.

## Backlog and Delivery Flow

1. Create/triage issue.
2. Add issue to `Jumentix` project.
3. Set field values and cycle dates.
4. Create the task-owned, nature-prefixed branch.
5. Implement with a dedicated PR linked to issue/project.
6. Move project status (`Backlog` -> `Ready` -> `In progress` -> `In review` -> `Done`).

## Cycle and Estimation Policy

1. Cycle window standard: 14 days (`Start date` / `End date` in project fields).
2. Every active task must have:
   - `Priority`
   - `Estimate` (story points)
   - cycle dates
3. Maximum story points per task item: **8**.
4. Any item above 8 points must be split into subtasks.
5. Subtasks inherit parent priority and cycle.
