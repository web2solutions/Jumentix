# AGENTS.md (Codex)

Primary Codex runtime instructions for this repository:

1. Use `rtk` prefix for shell commands.
2. Follow `.agents/requirements/*` and `.agents/NFR-REGISTRY.md` as mandatory constraints.
3. Treat GitHub Project Jumentix as the single source of truth for task tracking.
4. Keep specs/docs/agents in sync when requirements or behavior change.
5. Do not bypass quality gates; CI and coverage rules are mandatory.
6. Register in `.agents/AGENT-REGISTRY.md` before task execution.
7. Before starting work, check `main` and `dev` branch refs and update registry check fields.
8. Do not implement new changes directly on local `main`; use dedicated feature/fix/chore branches per requirement `079`.

Canonical governance/spec references:

- `documentation/md/SPEC-GOVERNANCE-AND-TRACEABILITY.md`
- `documentation/md/SPEC-REQUIREMENTS-TRACEABILITY-LEDGER.md`
- `documentation/md/SPEC-DEVELOPMENT-DRIVEN-INDEX.md`
