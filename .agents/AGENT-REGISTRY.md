# Jumentix Agent Registry

This registry tracks AI agents collaborating in the Jumentix project.

## Operating Rules

1. Every AI agent must register in this file before executing tasks.
2. Planning and task assignment must use only agents listed as `available`.
3. Before execution, the acting agent must verify latest `main` and `dev` branch references to reduce duplicate work.
4. Registry updates are mandatory when:
   - a new agent is introduced
   - agent availability changes
   - branch-sync policy changes
5. A consumer repository must update this canonical registry before synchronizing its local mirror.
6. Multiple agents may share a host, but each must use a unique `agent_id`.

## Registry Fields

- `agent_id`: unique identifier in this repository
- `agent_name`: display name
- `platform`: runtime/platform name
- `machine_id`: stable host identifier for audit traceability
- `machine_name`: host name for operator identification
- `machine_os`: operating system summary
- `agent_runtime`: runtime/distribution used to execute the agent
- `agent_version`: agent/runtime version string
- `status`: `available` | `busy` | `offline`
- `registered_at_utc`: ISO timestamp
- `last_branch_check_utc`: ISO timestamp
- `main_ref_checked`: short SHA from `main` checked by the agent
- `dev_ref_checked`: short SHA from `dev` checked by the agent
- `capabilities`: key collaboration capabilities

## Registered Agents

### 1) codex-primary-001

- `agent_id`: `codex-primary-001`
- `agent_name`: `Codex Primary`
- `platform`: `OpenAI Codex`
- `machine_id`: `host-eduardos-mac-pro-local`
- `machine_name`: `Eduardos-Mac-Pro.local`
- `machine_os`: `Darwin 21.6.0 x86_64`
- `agent_runtime`: `OpenAI Codex`
- `agent_version`: `GPT-5 Codex`
- `status`: `busy`
- `registered_at_utc`: `2026-07-25T00:00:00Z`
- `last_branch_check_utc`: `2026-07-26T04:27:30Z`
- `main_ref_checked`: `5d66c027`
- `dev_ref_checked`: `3a0d3020`
- `capabilities`:
  - repository analysis and implementation
  - test and CI debugging
  - spec/governance synchronization

## Operating Flow

1. Register or update the agent entry here before task execution.
2. Fetch and record the current `main` and `dev` refs for the consumer project.
3. Commit and merge the canonical registry update through this repository's branch and PR flow.
4. Run the consumer repository's registry synchronization command before its quality gate.
