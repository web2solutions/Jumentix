# AGENTS.md (Codex)

Primary Codex runtime instructions for this repository:

1. Use `rtk` prefix for shell commands.
2. Follow `.agents/requirements/*` and `.agents/NFR-REGISTRY.md` as mandatory constraints.
3. Treat Linear as the single source of truth for task and Project tracking. The Linear API key is at `../.linear` — read it for API authentication but never expose, log, commit, or share it.
4. Keep specs/docs/agents in sync when requirements or behavior change.
5. Do not bypass quality gates; CI and coverage rules are mandatory.
6. Register in `.agents/AGENT-REGISTRY.md` before task execution.
7. Before starting work, check `main` and `dev` branch refs and update registry check fields.
8. Do not implement new changes directly on local `main`; use dedicated feature/fix/chore branches per requirement `079`.
9. Follow the agent operating playbook defined in requirement `081` for registration, execution, and closure flow.
10. Treat `web2solutions/jumentix-agent-registry` as canonical source; local `.agents/AGENT-REGISTRY.md` is a mirror.
11. Work only on tasks with one focused parent epic and one primary nature; agent delegation is
    established at epic level before child-task assignment under requirement `090`.
12. Confirm the epic and its child task share one open milestone whose due date covers the work
    before planning or execution.
13. Treat an epic as a Linear Project and never set it to `Completed` until its dedicated
    documentation Issue is completed under requirement `094`.
14. Administrators may use a recorded project-owner approval to bypass only the required-review
    count; they must never bypass `dev`-first promotion or failed, missing, or incomplete quality,
    coverage, or security gates.
15. Maintain valid status, priority, start/target dates, and labels for every assigned Linear
    Issue and Project; record material changes in Project Updates and fail closed on missing,
    stale, contradictory, or placeholder metadata under requirement `097`.

Canonical governance/spec references:

- `documentation/md/SPEC-GOVERNANCE-AND-TRACEABILITY.md`
- `documentation/md/SPEC-REQUIREMENTS-TRACEABILITY-LEDGER.md`
- `documentation/md/SPEC-DEVELOPMENT-DRIVEN-INDEX.md`
