# OPENCODE.md (OpenCode)

This repository supports OpenCode as an official engineering agent.

## Working Rules

1. Execute repository commands using `rtk`, and compress your own prose with Caveman (Requirement `127`). Never compress code, commands, paths, identifiers, error messages, test counts, timings, or CI states — reproduce those verbatim. Bun scripts run as `rtk proxy bun run <script>`; where an agent lacks either tool, a declared replacement pattern is mandatory. How to do it: `documentation/md/AGENT-RTK-AND-CAVEMAN-GUIDE.md` (PT-BR: `documentation/md/AGENT-RTK-AND-CAVEMAN-GUIDE.pt-BR.md`).
2. Follow every file in `.agents/requirements/` and `.agents/NFR-REGISTRY.md`.
3. Use Linear as the source of truth for projects and tasks; never expose its API credential.
4. Before every task, fetch and read current `main` and `dev`, read the complete requirements inventory, NFR registry, and canonical specification index; block execution until current requirements are understood.
5. Register via `bun run agent-registry:register` (Firestore, Requirement `089`), update branch-check evidence via `bun run agent-registry:heartbeat`, and use a dedicated worktree, branch, and PR per task.
6. Keep implementation, specs, documentation, and agent guidance synchronized.
7. Do not bypass CI, lint, test, coverage, security, or governance gates; report exact gate states in Linear Project Updates.
8. Task PRs target `dev`; only `dev` release promotions target `main`.
9. Ensure Linear identifies the active `agent_identifier` for each executable Issue and Project/Epic, synchronized with the canonical Agent Registry.
10. Refresh sibling-agent progress, blockers, branches, PRs, and Linear Project Updates before starting or resuming work; coordinate overlap before editing files.
11. Start every PR title with the matching Linear Issue identifier:
   `[JUM-XXXX][Nature] <concise outcome>`.

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
