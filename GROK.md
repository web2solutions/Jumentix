# GROK.md (Grok)

This repository supports Grok as an official engineering agent.

## Working Rules

1. Execute repository commands using `rtk`, and compress your own prose with Caveman (Requirement `127`). Never compress code, commands, paths, identifiers, error messages, test counts, timings, or CI states — reproduce those verbatim. Bun scripts run as `rtk proxy bun run <script>`; where an agent lacks either tool, a declared replacement pattern is mandatory. How to do it: `documentation/md/AGENT-RTK-AND-CAVEMAN-GUIDE.md` (PT-BR: `documentation/md/AGENT-RTK-AND-CAVEMAN-GUIDE.pt-BR.md`).
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
    progress, blockers, branches, PRs, and Project Updates before starting or resuming work (`121`),
    and must publish/consume the Firebase RTDB agent bus via `agent-bus:publish|watch|status` (`129`).
18. Start every PR title with the matching Linear Issue identifier:
    `[JUM-XXXX][Nature] <concise outcome>` (086).

## Requirements Added Recently — Read Before Executing

Requirement `099` obliges every agent to read the full inventory before acting. These are the
most recent additions, listed here because an agent resuming from an older checkout will not
otherwise know they exist.

| requirement | obligation | enforced by |
| --- | --- | --- |
| `127` | Repository commands through `rtk`; agent prose compressed. Never compress code, commands, paths, identifiers, error messages, counts, timings or CI states. Bun scripts run as `rtk proxy bun run <script>`. | attestation |
| `128` | A merged change under `.agents/requirements/` takes precedence in the release queue. Precedence is **sequence only** and grants no exemption from any gate. | attestation + `065` |
| `129` | Publish material progress to the Firebase RTDB agent bus and consume it before starting or resuming a task. Firestore stays the ownership SSOT. | `agent-bus:publish` / `agent-bus:status` |
| `130` | Measured claims and bounded work: no number without the command that produced it, no proxy stated as a cause, corrections published where the claim was published, partial delivery reported as partial. | attestation |
| `131` | Every built entrypoint must carry every runtime export its source barrel declares. A stale `dist` loads cleanly and fails only at call time. | `bun run packages:check-build-freshness` |
| `132` | No orphaned published artifacts: content must resolve to a servable route, or be declared with the issue that owns the decision. The register fails in both directions. | `bun run website:check-content-routes` |

Both new gates run inside `ci:gate`. Requirements `127`, `128` and `130` are attestation-based
and say so in their own text — do not mistake them for gates.

## Required Governance Links

- `documentation/md/SPEC-GOVERNANCE-AND-TRACEABILITY.md`
- `documentation/md/SPEC-REQUIREMENTS-TRACEABILITY-LEDGER.md`
- `documentation/md/SPEC-DEVELOPMENT-DRIVEN-INDEX.md`
