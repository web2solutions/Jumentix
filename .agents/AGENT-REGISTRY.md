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
7. The canonical repository is `XpertMinds/jumentix-agent-registry`; the
   deprecated `web2solutions/jumentix-agent-registry` origin is read-only and
   accepts no new work.

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
- `active_epic`: focused epic currently delegated to the agent
- `assigned_task`: child task currently executed within the delegated epic
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
- `last_branch_check_utc`: `2026-07-30T05:01:29Z`
- `main_ref_checked`: `1f5cf3e1`
- `dev_ref_checked`: `19af3a52`
- `active_epic`: `https://linear.app/jumentix/project/epicgovernance-canonical-xpertminds-migration-and-legacy-freeze-f8bd0962ba8a`
- `assigned_task`: `https://linear.app/jumentix/issue/JUM-568`
- `capabilities`:
  - repository analysis and implementation
  - test and CI debugging
  - spec/governance synchronization

### 2) codex-website-001

- `agent_id`: `codex-website-001`
- `agent_name`: `Codex Website`
- `platform`: `OpenAI Codex`
- `machine_id`: `host-eduardos-mac-pro-local`
- `machine_name`: `Eduardos-Mac-Pro.local`
- `machine_os`: `Darwin 21.6.0 x86_64`
- `agent_runtime`: `OpenAI Codex`
- `agent_version`: `GPT-5 Codex`
- `status`: `available`
- `registered_at_utc`: `2026-07-26T07:23:33Z`
- `last_branch_check_utc`: `2026-07-29T09:25:00Z`
- `main_ref_checked`: `49d9af2e`
- `dev_ref_checked`: `6649d0e4`
- `active_epic`: `none`
- `assigned_task`: `none`
- `capabilities`:
  - frontend architecture and implementation
  - browser-driven UX research and verification
  - Storybook and website quality automation

### 3) codex-governance-001

- `agent_id`: `codex-governance-001`
- `agent_name`: `Codex Governance`
- `platform`: `OpenAI Codex`
- `machine_id`: `host-eduardos-mac-pro-local`
- `machine_name`: `Eduardos-Mac-Pro.local`
- `machine_os`: `Darwin 21.6.0 x86_64`
- `agent_runtime`: `OpenAI Codex`
- `agent_version`: `GPT-5 Codex`
- `status`: `available`
- `registered_at_utc`: `2026-07-27T19:02:28Z`
- `last_branch_check_utc`: `2026-07-29T09:25:00Z`
- `main_ref_checked`: `49d9af2e`
- `dev_ref_checked`: `6649d0e4`
- `active_epic`: `none`
- `assigned_task`: `none`
- `capabilities`:
  - repository governance and branch reconciliation
  - CI policy and branch protection enforcement
  - spec and traceability synchronization

### 4) codex-governance-002

- `agent_id`: `codex-governance-002`
- `agent_name`: `Codex Governance Metadata`
- `platform`: `OpenAI Codex`
- `machine_id`: `host-eduardos-mac-pro-local`
- `machine_name`: `Eduardos-Mac-Pro.local`
- `machine_os`: `Darwin 21.6.0 x86_64`
- `agent_runtime`: `OpenAI Codex`
- `agent_version`: `GPT-5 Codex`
- `status`: `available`
- `registered_at_utc`: `2026-07-27T20:55:33Z`
- `last_branch_check_utc`: `2026-07-29T09:25:00Z`
- `main_ref_checked`: `49d9af2e`
- `dev_ref_checked`: `6649d0e4`
- `active_epic`: `none`
- `assigned_task`: `none`
- `capabilities`:
  - governance requirements and traceability
  - Linear task metadata lifecycle
  - branch, PR, and quality-gate reconciliation

### 5) grok-cursor-001

- `agent_id`: `grok-cursor-001`
- `agent_name`: `Cursor Grok`
- `platform`: `Cursor`
- `machine_id`: `host-eduardos-macbook-air-arm64-local`
- `machine_name`: `Eduardos-MacBook-Air.local`
- `machine_os`: `Darwin 25.5.0 arm64`
- `agent_runtime`: `Cursor Grok 4.5`
- `agent_version`: `Cursor Grok 4.5`
- `status`: `available`
- `registered_at_utc`: `2026-07-29T07:50:00Z`
- `last_branch_check_utc`: `2026-07-29T09:35:00Z`
- `main_ref_checked`: `49d9af2e`
- `dev_ref_checked`: `0be97a25`
- `active_epic`: `none`
- `assigned_task`: `none`
- `capabilities`:
  - repository ownership analysis and governance delivery
  - Linear Project Updates and issue lifecycle
  - agent-registry hygiene and consumer mirror sync

### 6) claude-governance-001

- `agent_id`: `claude-governance-001`
- `agent_name`: `Claude (Code CLI)`
- `platform`: `Claude Code CLI`
- `machine_id`: `host-eduardos-macbook-air-arm64-local`
- `machine_name`: `Eduardos-MacBook-Air.local`
- `machine_os`: `Darwin 25.5.0 arm64`
- `agent_runtime`: `Claude Code CLI (local checkout, network-attached)`
- `agent_version`: `claude-sonnet-5`
- `status`: `busy`
- `registered_at_utc`: `2026-07-29T12:36:00Z`
- `last_branch_check_utc`: `2026-07-29T13:01:51Z`
- `main_ref_checked`: `2d4b4b47`
- `dev_ref_checked`: `d6dd5219`
- `active_epic`: `https://linear.app/jumentix/project/epicgovernance-epic-centered-task-taxonomy-and-agent-delegation-c3cb6bae0771`
- `assigned_task`: `https://linear.app/jumentix/issue/JUM-550`
- `capabilities`:
  - requirements registry hygiene and traceability reconciliation
  - governance documentation delivery with EN/PT-BR parity
  - CI gate script hardening and regression coverage

### 7) opencode-primary-001

- `agent_id`: `opencode-primary-001`
- `agent_name`: `OpenCode Primary`
- `platform`: `OpenCode`
- `machine_id`: `host-eduardos-mac-pro-local`
- `machine_name`: `Eduardos-Mac-Pro.local`
- `machine_os`: `Darwin 21.6.0 x86_64`
- `agent_runtime`: `OpenCode deepseek-v4-flash-free`
- `agent_version`: `deepseek-v4-flash-free`
- `status`: `available`
- `registered_at_utc`: `2026-07-30T05:30:00Z`
- `last_branch_check_utc`: `2026-07-30T05:30:00Z`
- `main_ref_checked`: `6f5dba04`
- `dev_ref_checked`: `4740bbca`
- `active_epic`: `none`
- `assigned_task`: `none`
- `capabilities`:
  - repository ownership analysis and governance delivery
  - CI gate repair and agent registry synchronization
  - multi-agent collision avoidance and worktree management

### 8) codex-primary-002

- `agent_id`: `codex-primary-002`
- `agent_name`: `Codex Primary 002`
- `platform`: `OpenAI Codex Desktop`
- `machine_id`: `host-eduardos-mac-pro-local`
- `machine_name`: `Eduardos-Mac-Pro.local`
- `machine_os`: `Darwin 21.6.0 x86_64`
- `agent_runtime`: `OpenAI Codex Desktop`
- `agent_version`: `GPT-5 Codex`
- `status`: `busy`
- `registered_at_utc`: `2026-08-01T09:13:19Z`
- `last_branch_check_utc`: `2026-08-01T10:18:30Z`
- `main_ref_checked`: `2592c997`
- `dev_ref_checked`: `62c22a05`
- `active_epic`: `https://linear.app/jumentix/project/epicci-private-free-ci-security-coverage-and-third-party-pr-review-bf8fde097cf1`
- `assigned_task`: `https://linear.app/jumentix/issue/JUM-591`
- `capabilities`:
  - repository-wide source and documentation assimilation
  - governed implementation, testing, and CI diagnostics
  - specification, Linear, and agent-registry traceability

## Operating Flow

1. Register or update the agent entry here before task execution.
2. Fetch and record the current `main` and `dev` refs for the consumer project.
3. Commit and merge the canonical registry update through this repository's branch and PR flow.
4. Run the consumer repository's registry synchronization command before its quality gate.
