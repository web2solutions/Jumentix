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

## Registry Fields

- `agent_id`: unique identifier in this repository
- `agent_name`: display name
- `platform`: runtime/platform name
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
- `status`: `available`
- `registered_at_utc`: `2026-07-25T00:00:00Z`
- `last_branch_check_utc`: `2026-07-25T00:00:00Z`
- `main_ref_checked`: `4e015522`
- `dev_ref_checked`: `b99c2026`
- `capabilities`:
  - repository analysis and implementation
  - test and CI debugging
  - spec/governance synchronization
