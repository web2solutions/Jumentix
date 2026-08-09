# GROK.md (Grok)

This repository supports Grok as an official engineering agent.

## Working Rules

1. Execute repository commands using `rtk`, and compress your own prose with Caveman (Requirement `127`). Never compress code, commands, paths, identifiers, error messages, test counts, timings, or CI states — reproduce those verbatim. Bun scripts run as `rtk proxy bun run <script>`; where an agent lacks either tool, a declared replacement pattern is mandatory.
2. Follow all requirements in `.agents/requirements/*`.
3. Keep `.agents/NFR-REGISTRY.md` synchronized when NFR behavior changes.
4. Use Linear as the source of truth for project management and new tasks. Read `../.linear`
   only for API authentication; never expose, log, commit, or share its contents.
5. Keep implementation, specs, and docs synchronized.
6. Respect CI, lint, test, and coverage gates; no bypass behavior is allowed.
7. Register via `bun run agent-registry:register` (Firestore, Requirement `089`) before task execution.
8. Before starting work, check `main` and `dev` refs and update them via `bun run agent-registry:heartbeat --main-ref --dev-ref`.
9. Work only on tasks with one focused parent epic and one primary nature.
10. Confirm epic-level agent delegation before accepting a child task, following Requirement `090`.
11. Confirm the focused epic and child task share one open milestone that covers their dates.
12. Treat an epic as a Linear Project and never complete it before its dedicated documentation
    Issue is completed under Requirement `094`.
13. Publish every task's start, material progress, blocker changes, review readiness, and final
    handoff in the Linear epic Project's `Project Updates` feed under Requirement `102`; Issue
    comments and status changes alone are insufficient.
14. Report exact gate states in Project Updates and never describe pending, missing, cancelled,
    timed-out, skipped, or failed required checks as passing.
15. Treat pull-request review as optional; require every destination-appropriate CI, quality,
    coverage, security, and governance check to finish successfully.
16. Before planning or executing any task, locate, read, and understand the complete current
    documentation inventory, every file in `.agents/requirements/`, `.agents/NFR-REGISTRY.md`,
    and the canonical specification index. All requirements are mandatory; uncertainty or an
    unread applicable source blocks execution until resolved.
17. Before every task, fetch/read current `main` and `dev`, re-read the full requirements set and
    NFR registry on both tips, avoid rework, and update registry branch-check evidence
    (Requirements `099`, `116`). Use the operator-confirmed worktree layout in Requirement `114`
    (this host root: `/Users/eduardoalmeida/apps/XpertMinds`).
    Tests must be functional and Jumentix-valued (`115`); new features ship docs (`117`);
    smoke/integration use Docker real services (`118`); orchestrate Linear/GitHub/others via
    APIs and always use `gh` for GitHub (`119`). Linear must identify the active
    `agent_identifier` on each Issue and Project/Epic (`120`), and agents must refresh sibling
    progress, blockers, branches, PRs, and Project Updates before starting or resuming work (`121`).
18. Start every PR title with the matching Linear Issue identifier:
    `[JUM-XXXX][Nature] <concise outcome>` (086).

## Required Governance Links

- `documentation/md/SPEC-GOVERNANCE-AND-TRACEABILITY.md`
- `documentation/md/SPEC-REQUIREMENTS-TRACEABILITY-LEDGER.md`
- `documentation/md/SPEC-DEVELOPMENT-DRIVEN-INDEX.md`
