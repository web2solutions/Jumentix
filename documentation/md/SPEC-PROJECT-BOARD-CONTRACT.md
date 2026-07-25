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

## Required Labels for Task Nature

At least one nature label:

1. `feature`
2. `bug`
3. `chore`
4. `doc`

Strategic stream labels are additive (for example `todo-mvp`, `epic`, `iteration-a`, `iteration-b`).

## Spec-Driven Workflow Through the Board

1. Intake:
   - create issue with clear objective and acceptance criteria.
2. Planning:
   - assign priority, size, estimate, dates, and labels.
3. Spec drafting:
   - list required spec resources before implementation.
4. Delivery:
   - link commits/PRs and capture evidence.
5. Closure:
   - set status to `Done` only after green checks and docs/agents sync.

## PR Linking Contract

Every PR must reference:

1. related issue(s)
2. project item scope
3. changed spec resources
4. evidence summary (tests/coverage/security)

And every issue should reflect:

1. PR URL(s)
2. merge/close status
3. residual follow-up items (if any)

## Anti-Drift Rule

If local todo snapshots and project board diverge, the project board is the source of truth and local docs must be synchronized in the same cycle.
