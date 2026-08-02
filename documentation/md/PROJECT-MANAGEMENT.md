# Project Management

## Backlog and Project Management

- Linear workspace: <https://linear.app/jumentix>
- The Linear API key is at `../.linear` (one level above project root) — access-controlled, never committed or shared.

Linear is the single source of truth for project management, epics, and task tracking (Requirement `095`). It must also identify the active `agent_identifier` for every executable Issue and Project/Epic, synchronized with the canonical Agent Registry (Requirement `120`).

Agents must refresh sibling-agent progress, blockers, branches, PRs, and Project Updates before starting or resuming work in the same epic, milestone, or component (Requirement `121`).

## Internal Requirement and MVP Tracking

- Technical requirements and specialized agents:
  - `.agents/README.md`
  - `.agents/AGENT-REGISTRY.md`
  - `AGENTS.md` (Codex)
  - `CLAUDE.md` (Claude Code)
  - `GROK.md` (Grok)
  - `OPENCODE.md` (OpenCode)
- Historical/local todo mirror (non-canonical):
  - `.agents/project-todos.md`
- GitHub issue tracking for migrated TODOs:
  - <https://github.com/XpertMinds/Jumentix/issues?q=is%3Aissue+is%3Aopen+label%3Atodo-mvp>
- Official planning authority:
  - Linear workspace: <https://linear.app/jumentix>
  - Linear API key at `../.linear` (access-controlled, never commit or share)
- Governance reference:
  - `documentation/md/JUMENTIX-PROJECT-GOVERNANCE.md`
- Domain Designer MVP roadmap:
  - `documentation/md/DOMAIN-DESIGNER-MVP-ROADMAP.md`
