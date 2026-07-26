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
5. Registry must support multiple agents running on the same machine with unique `agent_id` values.

## Registry Fields

- `agent_id`: unique identifier in this repository
- `agent_name`: display name
- `platform`: runtime/platform name
- `machine_id`: stable host identifier for audit traceability
- `machine_name`: host machine name
- `machine_os`: host operating system summary
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
- `status`: `available`
- `registered_at_utc`: `2026-07-25T00:00:00Z`
- `last_branch_check_utc`: `2026-07-26T00:39:16Z`
- `main_ref_checked`: `b9690eeb`
- `dev_ref_checked`: `28bb68ce`
- `capabilities`:
  - repository analysis and implementation
  - test and CI debugging
  - spec/governance synchronization
