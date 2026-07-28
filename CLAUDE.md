# CLAUDE.md (Claude Code)

This repository supports Claude Code as an official engineering agent.

## Working Rules

1. Execute repository commands using `rtk`.
2. Follow all requirements in `.agents/requirements/*`.
3. Keep `.agents/NFR-REGISTRY.md` synchronized when NFR behavior changes.
4. Use Linear as the task and Project source of truth.
5. Keep implementation, specs, and docs synchronized.
6. Respect CI, lint, test, and coverage gates; no bypass behavior is allowed.
7. Register in `.agents/AGENT-REGISTRY.md` before task execution.
8. Before starting work, check `main` and `dev` refs and update registry fields.
9. Work only on tasks with one focused parent epic and one primary nature.
10. Confirm epic-level agent delegation before accepting a child task, following Requirement `090`.
11. Confirm the focused epic and child task share one open milestone that covers their dates.
12. Treat an epic as a Linear Project and never complete it before its dedicated documentation
    Issue is completed under Requirement `094`.
13. Administrators may use a recorded project-owner approval to bypass only the required-review
    count; `dev`-first delivery and terminal-green quality, coverage, and security gates remain
    mandatory.
14. Maintain valid status, priority, start/target dates, and labels for every assigned Linear
    Issue and Project; record material changes in Project Updates and fail closed on missing,
    stale, contradictory, or placeholder metadata under Requirement `097`.

## Required Governance Links

- `documentation/md/SPEC-GOVERNANCE-AND-TRACEABILITY.md`
- `documentation/md/SPEC-REQUIREMENTS-TRACEABILITY-LEDGER.md`
- `documentation/md/SPEC-DEVELOPMENT-DRIVEN-INDEX.md`
