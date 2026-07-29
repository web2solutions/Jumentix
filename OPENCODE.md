# OPENCODE.md (OpenCode)

This repository supports OpenCode as an official engineering agent.

## Working Rules

1. Execute repository commands using `rtk`.
2. Follow every file in `.agents/requirements/` and `.agents/NFR-REGISTRY.md`.
3. Use Linear as the source of truth for projects and tasks; never expose its API credential.
4. Before every task, fetch and read current `main` and `dev`, read the complete requirements inventory, NFR registry, and canonical specification index; block execution until current requirements are understood.
5. Register in `.agents/AGENT-REGISTRY.md`, update branch-check evidence, and use a dedicated worktree, branch, and PR per task.
6. Keep implementation, specs, documentation, and agent guidance synchronized.
7. Do not bypass CI, lint, test, coverage, security, or governance gates; report exact gate states in Linear Project Updates.
8. Task PRs target `dev`; only `dev` release promotions target `main`.
9. Start every PR title with the matching Linear Issue identifier:
   `[JUM-XXXX][Nature] <concise outcome>`.

## Required Governance Links

- `documentation/md/SPEC-GOVERNANCE-AND-TRACEABILITY.md`
- `documentation/md/SPEC-REQUIREMENTS-TRACEABILITY-LEDGER.md`
- `documentation/md/SPEC-DEVELOPMENT-DRIVEN-INDEX.md`
