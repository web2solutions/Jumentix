# Requirement 102 - Linear Project Task Progress Updates

## Context

Linear is the Jumentix project-management source of truth. An epic is represented by a Linear
Project and each executable task by a Linear Issue. Issue status changes, comments, local notes,
and pull-request activity do not by themselves provide an epic-level progress record. Every
executing agent must therefore publish truthful, task-specific progress in the Project's
`Project Updates` feed.

## Mandatory Rules

1. Every human or AI agent executing a Linear Issue must publish progress in the parent Linear
   Project's `Project Updates` feed.
2. An Issue comment or status change does not replace the corresponding Project Update.
3. A Project Update is required when the task is accepted or starts, after material progress,
   whenever a blocker or material risk changes, when the pull request becomes review-ready, and
   at completion or handoff.
4. Each update must identify the task ID and link, accountable agent, current task status,
   completed outcome, branch, pull request and commit when available, exact validation-gate
   state, blockers or risks, and the next action.
5. Gate evidence must be fail-closed. Pending, failed, timed-out, cancelled, skipped, missing, or
   unreported required checks must never be described as passing or green.
6. Updates must report observable outcomes, not unsupported percentages or success claims.
7. When multiple tasks or agents progress concurrently, the update must use clearly separated
   task-and-agent sections so ownership and evidence cannot be confused.
8. A materially stale Project Update must be superseded by a new update; historical updates
   remain immutable audit evidence and must not be rewritten to conceal earlier state.
9. Project completion evidence must include a final Project Update for every completed task,
   including the dedicated documentation Issue required by Requirement `094`.
10. A Project must not be set to `Completed` while any task lacks its final Project Update or
    while the latest update reports an unresolved blocker or incomplete required gate.
11. Project Updates complement, and do not replace, Issue metadata, the Agent Registry,
    task-owned worktrees, branches, commits, pull requests, documentation, or validation evidence.

## Required Update Template

Each task section in a Project Update must contain:

1. `Task`: Linear Issue ID and link.
2. `Agent`: accountable human or AI agent.
3. `Status`: current Linear workflow state.
4. `Completed`: concrete outcomes since the preceding update.
5. `Delivery`: worktree, branch, commit, and pull request links or `not yet created`.
6. `Gates`: each required gate and its exact terminal or pending state.
7. `Blockers/Risks`: current blockers and material risks, or `none`.
8. `Next`: the next concrete action.

## Acceptance Criteria

1. Governance defines Linear Projects as epics, Linear Issues as tasks, and `Project Updates` as
   the mandatory epic-level task-progress channel.
2. All supported agent instructions define the same update cadence and truthful evidence rules.
3. Bilingual governance, delivery-gate, traceability-ledger, and coverage documents reference
   this requirement.
4. Project completion is blocked until every completed task has a final Project Update and the
   documentation-task gate from Requirement `094` is satisfied.
5. Audit evidence can trace each update to its task, agent, delivery artifacts, gates, blockers,
   and next action.

## Evidence and Scope

- Applies to every current and future Linear Project used as a Jumentix epic and every human or
  AI agent executing its Issues.
- Evidence includes the Linear Project Updates feed, linked Issues, agent identity, delivery
  artifacts, exact gate results, blocker history, and final task handoff.
- Complements requirements `065`, `067`, `076`, `077`, `078`, `081`, `086`, `087`, `088`, `090`,
  and `094`.
