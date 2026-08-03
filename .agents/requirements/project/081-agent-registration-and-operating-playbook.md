# Requirement 081 - Agent Registration and Operating Playbook

## Context

Agent governance is only reliable when every agent follows the same operational routine before, during, and after task execution.

## Requirement

Jumentix must define an explicit playbook that teaches agents:

1. how to register themselves in `.agents/AGENT-REGISTRY.md`;
2. how to validate branch state before starting work;
3. how to execute tasks under project governance;
4. how to update status and audit evidence when work is completed.

## Mandatory Agent Playbook

### 1) Registration (before any task)

1. Create or update the agent entry with:
   - `agent_id`
   - `agent_name`
   - `platform`
   - `machine_id`
   - `machine_name`
   - `machine_os`
   - `agent_runtime`
   - `agent_version`
   - `status`
   - `registered_at_utc`
2. Ensure `agent_id` is unique, including when multiple agents run on the same host machine.

### 2) Branch Sync Check (before planning/execution)

1. Fetch latest `main` and `dev`.
2. Record `last_branch_check_utc`, `main_ref_checked`, and `dev_ref_checked` in the registry.
3. Confirm work is not being developed directly on local `main` (follow Requirement `079`).

### 3) Task Governance Execution

1. Use Linear as the source of truth (Requirement `095`). The Linear API key is at `../.linear`.
2. Confirm that the task has exactly one focused parent epic, one primary nature, and the same
   open milestone as its epic under Requirement `090`.
3. Confirm the milestone due date covers the epic and task delivery dates.
4. Confirm the agent is delegated to the parent epic before accepting its child task.
5. Ensure the task is represented by a Linear Issue in its focused Linear Project, with required
   planning fields and structured parent-epic and milestone linkage.
6. Record `active_epic` and `assigned_task` in the canonical Agent Registry.
7. Keep scope aligned with the milestone target, epic outcome, task nature, priority, and branch
   purpose.
8. Keep specs/docs/agents synchronized when behavior or requirements change.

### 4) Delivery and Closure

1. Open a PR linked to the Linear Issue and focused Project.
2. Include requirement IDs and evidence of quality gates.
3. Publish Linear `Project Updates` for the task using the canonical Template D in
   `documentation/md/SPEC-TEMPLATES-AND-CHECKLISTS.md` (and PT-BR twin) under Requirement `102`:
   start, material progress, blocker changes, review-ready, and final handoff. Never describe
   pending, failed, missing, cancelled, timed-out, or skipped required checks as passing.
4. Set agent status transitions as needed (`available`/`busy`/`offline`) in registry updates.
5. Preserve traceability: branch -> commits -> PR -> Linear Issue -> Linear Project -> Project Update.
6. Clear or update the agent's epic/task assignment when delegation ends.

## Acceptance Criteria

1. This playbook exists as a tracked requirement.
2. Agent registry and governance docs reference this execution model.
3. Agent instruction surfaces enforce registration + branch check + governed delivery.
4. Milestone association, epic delegation, and child-task ownership are auditable in Linear and
   the Agent Registry; GitHub records delivery branches, commits, PRs, and checks.
