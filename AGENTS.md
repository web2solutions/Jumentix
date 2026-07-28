# AGENTS.md (Codex)

Primary Codex runtime instructions for this repository:

1. Use `rtk` prefix for shell commands.
2. Follow `.agents/requirements/*` and `.agents/NFR-REGISTRY.md` as mandatory constraints.
3. Treat Linear as the single source of truth for project management and new tasks.
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
14. Publish every task's start, material progress, blocker changes, review readiness, and final
    handoff in the Linear epic Project's `Project Updates` feed under requirement `095`; Issue
    comments and status changes alone are insufficient.
15. Report exact gate states in Project Updates and never describe pending, missing, cancelled,
    timed-out, skipped, or failed required checks as passing.

Canonical governance/spec references:

- `documentation/md/SPEC-GOVERNANCE-AND-TRACEABILITY.md`
- `documentation/md/SPEC-REQUIREMENTS-TRACEABILITY-LEDGER.md`
- `documentation/md/SPEC-DEVELOPMENT-DRIVEN-INDEX.md`
