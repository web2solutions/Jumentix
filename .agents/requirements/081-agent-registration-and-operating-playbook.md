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

1. Use GitHub Project Jumentix as the source of truth.
2. Ensure the task is represented by issue + project item with required planning fields.
3. Keep scope aligned with task priority and branch purpose.
4. Keep specs/docs/agents synchronized when behavior or requirements change.

### 4) Delivery and Closure

1. Open PR linked to issue/project item.
2. Include requirement IDs and evidence of quality gates.
3. Set agent status transitions as needed (`available`/`busy`/`offline`) in registry updates.
4. Preserve traceability: branch -> commits -> PR -> issue -> project item.

## Acceptance Criteria

1. This playbook exists as a tracked requirement.
2. Agent registry and governance docs reference this execution model.
3. Agent instruction surfaces enforce registration + branch check + governed delivery.
